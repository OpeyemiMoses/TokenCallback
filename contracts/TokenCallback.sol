// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenCallback
 * @notice Time-locked token escrow. Sender can cancel before recipient claims.
 *         Supports both native MON and ERC-20 tokens on Monad.
 */
contract TokenCallback is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ────────────────────────────────────────────────────────────────

    uint256 public constant FALLBACK_DELAY = 30 days;

    struct Transfer {
        uint256 id;
        address sender;
        address recipient;
        address token;      // address(0) = native MON
        uint256 amount;
        uint256 deadline;   // Unix timestamp — after this, sender can auto-refund
        bool claimed;
        bool cancelled;
    }

    uint256 private _nextId;

    /// @dev transferId => Transfer
    mapping(uint256 => Transfer) public transfers;

    /// @dev sender => list of transfer IDs
    mapping(address => uint256[]) private _sentTransfers;

    /// @dev recipient => list of transfer IDs
    mapping(address => uint256[]) private _receivedTransfers;

    // ─── Events ───────────────────────────────────────────────────────────────

    event TransferCreated(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        address token,
        uint256 amount,
        uint256 deadline
    );

    event TransferClaimed(uint256 indexed id, address indexed recipient);
    event TransferCancelled(uint256 indexed id, address indexed sender);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error InvalidRecipient();
    error CannotSendToSelf();
    error DeadlineMustBeFuture();
    error AmountZero();
    error IncorrectNativeAmount();
    error NativeSentWithERC20();
    error NotSender();
    error NotRecipient();
    error AlreadyClaimed();
    error AlreadyCancelled();
    error NotExpiredYet();
    error NativeTransferFailed();
    error SafetyWindowActive();
    error SafetyWindowExpired();

    // ─── Core Functions ───────────────────────────────────────────────────────

    /**
     * @notice Create a pending transfer. Tokens are locked in this contract
     *         until the recipient claims or the sender cancels.
     * @param recipient   Address that can claim the tokens.
     * @param token       ERC-20 contract address, or address(0) for native MON.
     * @param amount      Token amount (or msg.value if native MON).
     * @param deadline    Unix timestamp after which sender can auto-refund.
     * @return id         Unique transfer ID.
     */
    function send(
        address recipient,
        address token,
        uint256 amount,
        uint256 deadline
    ) external payable nonReentrant returns (uint256 id) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (recipient == msg.sender) revert CannotSendToSelf();
        if (deadline <= block.timestamp) revert DeadlineMustBeFuture();
        if (amount == 0) revert AmountZero();

        if (token == address(0)) {
            // Native MON transfer
            if (msg.value != amount) revert IncorrectNativeAmount();
        } else {
            // ERC-20 transfer
            if (msg.value != 0) revert NativeSentWithERC20();
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        id = _nextId++;
        transfers[id] = Transfer({
            id: id,
            sender: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            deadline: deadline,
            claimed: false,
            cancelled: false
        });

        _sentTransfers[msg.sender].push(id);
        _receivedTransfers[recipient].push(id);

        emit TransferCreated(id, msg.sender, recipient, token, amount, deadline);
    }

    /**
     * @notice Cancel a pending transfer and reclaim tokens.
     *         Can be called any time before the recipient claims.
     * @param id  Transfer ID to cancel.
     */
    function cancel(uint256 id) external nonReentrant {
        Transfer storage t = transfers[id];
        if (t.sender != msg.sender) revert NotSender();
        if (t.claimed) revert AlreadyClaimed();
        if (t.cancelled) revert AlreadyCancelled();
        if (block.timestamp >= t.deadline) revert SafetyWindowExpired();

        t.cancelled = true;
        _refund(t.token, t.sender, t.amount);

        emit TransferCancelled(id, msg.sender);
    }

    /**
     * @notice Claim a pending transfer sent to you.
     * @param id  Transfer ID to claim.
     */
    function claim(uint256 id) external nonReentrant {
        Transfer storage t = transfers[id];
        if (t.recipient != msg.sender) revert NotRecipient();
        if (t.claimed) revert AlreadyClaimed();
        if (t.cancelled) revert AlreadyCancelled();
        if (block.timestamp < t.deadline) revert SafetyWindowActive();

        t.claimed = true;
        _refund(t.token, t.recipient, t.amount);

        emit TransferClaimed(id, msg.sender);
    }

    /**
     * @notice Reclaim tokens from an expired transfer that was never claimed.
     *         Can be called by the sender if the fallback delay has passed.
     * @param id  Transfer ID to refund.
     */
    function refundExpired(uint256 id) external nonReentrant {
        Transfer storage t = transfers[id];
        if (t.sender != msg.sender) revert NotSender();
        if (t.claimed) revert AlreadyClaimed();
        if (t.cancelled) revert AlreadyCancelled();
        if (block.timestamp <= t.deadline + FALLBACK_DELAY) revert NotExpiredYet();

        t.cancelled = true;
        _refund(t.token, t.sender, t.amount);

        emit TransferCancelled(id, msg.sender);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /// @notice Get all transfer IDs sent by `sender`.
    function getSentTransfers(address sender) external view returns (uint256[] memory) {
        return _sentTransfers[sender];
    }

    /// @notice Get all transfer IDs pending for `recipient`.
    function getReceivedTransfers(address recipient) external view returns (uint256[] memory) {
        return _receivedTransfers[recipient];
    }

    /// @notice Get full details of a transfer by ID.
    function getTransfer(uint256 id) external view returns (Transfer memory) {
        return transfers[id];
    }

    /// @notice Total number of transfers ever created.
    function totalTransfers() external view returns (uint256) {
        return _nextId;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _refund(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool ok,) = to.call{value: amount}("");
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
}
