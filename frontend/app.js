/* ==========================================================================
   CallBack — app.js
   Wallet connection + contract interaction via ethers.js v6
   ========================================================================== */

// ─── Config ──────────────────────────────────────────────────────────────────

const CONTRACT_ADDRESS = "0x2Cb084E68ef4e6a9cA0512Bd5f722ADe672F36Be"; // Monad Mainnet

const MONAD_MAINNET = {
  chainId:         "0x8F",  // 143
  chainIdDecimal:  143,
  chainName:       "Monad Mainnet",
  rpcUrls:         ["https://rpc.monad.xyz/"],
  nativeCurrency:  { name: "MON", symbol: "MON", decimals: 18 },
  blockExplorerUrls: ["https://monadscan.com"],
};

const EXPLORER_URL = MONAD_MAINNET.blockExplorerUrls[0];

// Minimal ABI — only what we need
const ABI = [
  // Write
  "function send(address recipient, address token, uint256 amount, uint256 deadline) payable returns (uint256)",
  "function cancel(uint256 id)",
  "function claim(uint256 id)",
  "function refundExpired(uint256 id)",
  // Read
  "function getSentTransfers(address sender) view returns (uint256[])",
  "function getReceivedTransfers(address recipient) view returns (uint256[])",
  "function getTransfer(uint256 id) view returns (tuple(uint256 id, address sender, address recipient, address token, uint256 amount, uint256 deadline, bool claimed, bool cancelled))",
  "function totalTransfers() view returns (uint256)",
  // ERC-20 helpers
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

// ─── State ───────────────────────────────────────────────────────────────────

let provider    = null;
let signer      = null;
let contract    = null;
let userAddress = null;

let selectedTokenType  = "native";  // "native" | "erc20"
let selectedDeadlineSec = 3600;     // default 1 hour
let nativeBalance       = 0n;

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", async () => {
  updateSummary();

  // Auto-reconnect if localStorage says we connected previously
  if (localStorage.getItem("walletConnected") === "true" && window.ethereum) {
    try { await connectWallet(); } catch (_) {}
  }

  // Watch form inputs for live summary
  ["recipient", "amount", "token-address"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", updateSummary);
  });
});

// ─── Wallet ───────────────────────────────────────────────────────────────────

async function connectWallet() {
  if (!window.ethereum) {
    showToast("No wallet detected. Install EVM wallet", "error");
    return;
  }

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);

    // Switch to Monad Testnet
    await switchToMonad();

    signer      = await provider.getSigner();
    userAddress = await signer.getAddress();
    contract    = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

    onConnected();

    // Listen for account / chain changes
    window.ethereum.on("accountsChanged", accounts => {
      if (accounts.length === 0) onDisconnected();
      else location.reload();
    });
    window.ethereum.on("chainChanged", () => location.reload());

  } catch (err) {
    console.error(err);
    if (err.code !== 4001) showToast("Connection failed: " + shortError(err), "error");
  }
}

async function switchToMonad() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_MAINNET.chainId }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [MONAD_MAINNET],
      });
    } else {
      throw err;
    }
  }
}

function onConnected() {
  localStorage.setItem("walletConnected", "true");
  closeMobileMenu();

  // Hide connect button, show wallet info
  document.getElementById("connect-btn").classList.add("hidden");
  document.getElementById("wallet-info").classList.remove("hidden");
  document.getElementById("network-badge").classList.remove("hidden");
  document.getElementById("wallet-address").textContent = shortAddress(userAddress);

  // Show main app
  document.getElementById("not-connected").classList.add("hidden");
  document.getElementById("main-app").classList.remove("hidden");

  // Load data
  loadStats();
  loadNativeBalance();
  loadOutbox();
  loadInbox();

  // Refresh countdowns every second
  setInterval(refreshCountdowns, 1000);
  
  // Refresh balance every 10 seconds to keep UI synced
  setInterval(loadNativeBalance, 10000);
}

function disconnectWallet() {
  localStorage.removeItem("walletConnected");
  closeMobileMenu();

  // Clear local state — MetaMask manages its own connection
  provider    = null;
  signer      = null;
  contract    = null;
  userAddress = null;
  nativeBalance = 0n;

  // Reset UI back to "not connected" state
  document.getElementById('connect-btn')?.classList.remove('hidden');
  document.getElementById('wallet-info')?.classList.add('hidden');
  document.getElementById('network-badge')?.classList.add('hidden');
  document.getElementById('not-connected')?.classList.remove('hidden');
  document.getElementById('main-app')?.classList.add('hidden');

  showToast('Wallet disconnected', 'info');
}

function onDisconnected() {
  disconnectWallet();
}

// ─── Stats ────────────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const total = await contract.totalTransfers();
    // Main hero stat
    const statEl = document.getElementById("stat-total");
    if (statEl) statEl.textContent = total.toString();
  } catch (_) {}
}

async function loadNativeBalance() {
  try {
    nativeBalance = await provider.getBalance(userAddress);
    // Dashboard header balance
    const balEl = document.getElementById("stat-balance");
    if (balEl) balEl.textContent = Number(ethers.formatEther(nativeBalance)).toFixed(3) + " MON";
    updateBalanceHint();
  } catch (_) {}
}

function updateBalanceHint() {
  const hint = document.getElementById("balance-hint");
  if (selectedTokenType === "native") {
    hint.textContent = `Balance: ${formatAmount(nativeBalance, 18)} MON`;
  }
}

// ─── Token Type Toggle ────────────────────────────────────────────────────────

function setTokenType(type) {
  selectedTokenType = type;

  document.getElementById("toggle-native").classList.toggle("active", type === "native");
  document.getElementById("toggle-erc20").classList.toggle("active", type === "erc20");

  const erc20Field = document.getElementById("erc20-field");
  erc20Field.style.display = type === "erc20" ? "flex" : "none";
  erc20Field.style.flexDirection = "column";
  erc20Field.style.gap = "8px";

  updateBalanceHint();
  updateSummary();
}

// ERC-20 token info lookup
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("token-address")?.addEventListener("change", lookupTokenInfo);
});

async function lookupTokenInfo() {
  const addr = document.getElementById("token-address").value.trim();
  const hint = document.getElementById("token-name-hint");
  if (!addr || !ethers.isAddress(addr) || !signer) {
    hint.textContent = "";
    return;
  }
  try {
    const erc20 = new ethers.Contract(addr, ABI, signer);
    const [name, symbol, decimals, bal] = await Promise.all([
      erc20.name(),
      erc20.symbol(),
      erc20.decimals(),
      erc20.balanceOf(userAddress),
    ]);
    hint.textContent = `${name} (${symbol}) · Balance: ${formatAmount(bal, decimals)} ${symbol}`;
    hint.className = "field-hint success";
  } catch (_) {
    hint.textContent = "Not a valid ERC-20 token";
    hint.className = "field-hint error";
  }
}

// ─── Timelock ─────────────────────────────────────────────────────────────────

function setTimelock(seconds, btn) {
  document.querySelectorAll(".timelock-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  const customField = document.getElementById("custom-timelock-field");
  if (seconds === "custom") {
    customField.style.display = "block";
    selectedDeadlineSec = null;
  } else {
    customField.style.display = "none";
    selectedDeadlineSec = seconds;
  }
  updateSummary();
}

function getSelectedDeadlineSec() {
  if (selectedDeadlineSec !== null) return selectedDeadlineSec;
  const hours = parseFloat(document.getElementById("custom-hours").value);
  if (!isNaN(hours) && hours > 0) return Math.round(hours * 3600);
  return null;
}

// ─── Max Button ───────────────────────────────────────────────────────────────

async function setMaxAmount() {
  if (selectedTokenType === "native") {
    // Leave some for gas
    const gas = ethers.parseEther("0.01");
    const max = nativeBalance > gas ? nativeBalance - gas : 0n;
    document.getElementById("amount").value = ethers.formatEther(max);
  } else {
    const addr = document.getElementById("token-address").value.trim();
    if (!addr || !ethers.isAddress(addr) || !signer) return;
    try {
      const erc20 = new ethers.Contract(addr, ABI, signer);
      const [bal, dec] = await Promise.all([erc20.balanceOf(userAddress), erc20.decimals()]);
      document.getElementById("amount").value = formatAmount(bal, dec);
    } catch (_) {}
  }
  updateSummary();
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function updateSummary() {
  const amount    = document.getElementById("amount")?.value;
  const recipient = document.getElementById("recipient")?.value.trim();
  const deadline  = getSelectedDeadlineSec();

  const summary = document.getElementById("transfer-summary");
  if (!summary) return;

  if (amount && recipient && deadline) {
    summary.style.display = "flex";
    document.getElementById("summary-amount").textContent =
      `${amount} ${selectedTokenType === "native" ? "MON" : "tokens"}`;
    document.getElementById("summary-recipient").textContent = shortAddress(recipient);
    document.getElementById("summary-window").textContent   = formatDuration(deadline);
  } else {
    summary.style.display = "none";
  }
}

// ─── Send ─────────────────────────────────────────────────────────────────────

async function handleSend(e) {
  e.preventDefault();
  if (!contract) return;

  const recipientRaw = document.getElementById("recipient").value.trim();
  const amountRaw    = document.getElementById("amount").value.trim();
  const deadline     = getSelectedDeadlineSec();

  if (!ethers.isAddress(recipientRaw)) {
    showToast("Invalid recipient address", "error"); return;
  }
  if (recipientRaw.toLowerCase() === userAddress.toLowerCase()) {
    showToast("Cannot send to your own connected address", "error"); return;
  }
  if (!deadline || deadline <= 0) {
    showToast("Please select or enter a valid safety window", "error"); return;
  }

  const deadlineTs = BigInt(Math.floor(Date.now() / 1000) + deadline);

  openModal("Confirm in Wallet", "Confirming in wallet…");

  try {
    let tx;

    if (selectedTokenType === "native") {
      const value = ethers.parseEther(amountRaw);
      tx = await contract.send(recipientRaw, ethers.ZeroAddress, value, deadlineTs, { value });

    } else {
      const tokenAddr = document.getElementById("token-address").value.trim();
      if (!ethers.isAddress(tokenAddr)) {
        closeModal(); showToast("Invalid token address", "error"); return;
      }
      const erc20 = new ethers.Contract(tokenAddr, ABI, signer);
      const decimals = await erc20.decimals();
      const amount   = ethers.parseUnits(amountRaw, decimals);

      // Check + request allowance
      const allowance = await erc20.allowance(userAddress, CONTRACT_ADDRESS);
      if (allowance < amount) {
        updateModal("Approving Token Spend", "Confirming in wallet…");
        const approveTx = await erc20.approve(CONTRACT_ADDRESS, ethers.MaxUint256);
        updateModal("Waiting for Approval…", "Transaction submitted. Waiting for confirmation.");
        await approveTx.wait();
      }

      updateModal("Confirm Transfer", "Confirming in wallet…");
      tx = await contract.send(recipientRaw, tokenAddr, amount, deadlineTs);
    }

    updateModal("Broadcasting…", "Transaction submitted. Waiting for confirmation.", tx.hash);
    const receipt = await tx.wait();

    successModal("Transfer Created!", `Your tokens are locked in escrow. You can cancel anytime before the recipient claims.`, tx.hash);
    showToast("Transfer created successfully!", "success");

    // Reset form
    document.getElementById("send-form").reset();
    document.getElementById("transfer-summary").style.display = "none";
    setTokenType("native");

    loadStats();
    loadNativeBalance();
    loadOutbox();
    loadInbox();

  } catch (err) {
    console.error(err);
    closeModal();
    if (err.code !== 4001) showToast("Transaction failed: " + shortError(err), "error");
    else showToast("Transaction cancelled", "info");
  }
}

// ─── Outbox ───────────────────────────────────────────────────────────────────

async function loadOutbox() {
  if (!contract || !userAddress) return;

  const list    = document.getElementById("outbox-list");
  const loading = document.getElementById("outbox-loading");
  const empty   = document.getElementById("outbox-empty");

  loading.classList.remove("hidden");
  empty.classList.add("hidden");

  // Remove old cards
  list.querySelectorAll(".transfer-card").forEach(c => c.remove());

  try {
    const ids = await contract.getSentTransfers(userAddress);
    loading.classList.add("hidden");

    if (ids.length === 0) {
      empty.classList.remove("hidden");
      updateBadge("outbox-badge", 0);
      return;
    }

    const transfers = await Promise.all(ids.map(id => contract.getTransfer(id)));
    const pending   = transfers.filter(t => !t.claimed && !t.cancelled);
    updateBadge("outbox-badge", pending.length);

    // Show newest first
    [...transfers].reverse().forEach(t => {
      const card = buildOutboxCard(t);
      list.appendChild(card);
    });

  } catch (err) {
    loading.classList.add("hidden");
    console.error(err);
    showToast("Failed to load outbox", "error");
  }
}

function buildOutboxCard(t) {
  const card = document.createElement("div");
  card.className = "transfer-card";
  card.id = `out-card-${t.id}`;
  card.dataset.deadline = t.deadline.toString();

  const status    = getStatus(t);
  const isNative  = t.token === ethers.ZeroAddress;
  const isPending = status === "pending";
  const isExpired = status === "expired";
  
  const now = Math.floor(Date.now() / 1000);
  const isSafetyActive = now < Number(t.deadline);
  // Reclaim fallback is active after 30 days
  const isFallbackActive = now >= Number(t.deadline) + 2592000;

  card.innerHTML = `
    <div class="transfer-card-header">
      <div>
        <div class="transfer-id">Transfer #${t.id}</div>
        <div class="transfer-amount-big" style="margin-top:4px">${formatTransferAmount(t)} ${isNative ? "MON" : "tokens"}</div>
      </div>
      ${statusBadge(status, false)}
    </div>
    <div class="transfer-card-body">
      <div class="transfer-row">
        <span class="transfer-label">To</span>
        <span class="transfer-value mono full-address">${t.recipient}</span>
      </div>
      <div class="transfer-row">
        <span class="transfer-label">Token</span>
        <span class="transfer-value">${isNative ? "Native MON" : shortAddress(t.token)}</span>
      </div>
      <div class="transfer-row">
        <span class="transfer-label">Safety deadline</span>
        <span class="transfer-value">${new Date(Number(t.deadline) * 1000).toLocaleString()}</span>
      </div>
    </div>
    <div class="transfer-card-footer">
      <span class="countdown" id="countdown-out-${t.id}">${countdownText(t.deadline)}</span>
      <div style="display:flex;gap:8px">
        ${isPending && isSafetyActive ? `<button class="btn btn-danger" onclick="handleCancel(${t.id})">Cancel & Refund</button>` : ""}
        ${isPending && !isSafetyActive && isFallbackActive ? `<button class="btn btn-outline" onclick="handleRefundExpired(${t.id})">Reclaim Expired</button>` : ""}
      </div>
    </div>
  `;
  return card;
}

// ─── Inbox ────────────────────────────────────────────────────────────────────

async function loadInbox() {
  if (!contract || !userAddress) return;

  const list    = document.getElementById("inbox-list");
  const loading = document.getElementById("inbox-loading");
  const empty   = document.getElementById("inbox-empty");

  loading.classList.remove("hidden");
  empty.classList.add("hidden");

  list.querySelectorAll(".transfer-card").forEach(c => c.remove());

  try {
    const ids = await contract.getReceivedTransfers(userAddress);
    loading.classList.add("hidden");

    if (ids.length === 0) {
      empty.classList.remove("hidden");
      updateBadge("inbox-badge", 0);
      return;
    }

    const transfers = await Promise.all(ids.map(id => contract.getTransfer(id)));
    const pending   = transfers.filter(t => !t.claimed && !t.cancelled);
    updateBadge("inbox-badge", pending.length);

    [...transfers].reverse().forEach(t => {
      const card = buildInboxCard(t);
      list.appendChild(card);
    });

  } catch (err) {
    loading.classList.add("hidden");
    console.error(err);
    showToast("Failed to load inbox", "error");
  }
}

function buildInboxCard(t) {
  const card = document.createElement("div");
  card.className = "transfer-card";
  card.id = `in-card-${t.id}`;
  card.dataset.deadline = t.deadline.toString();

  const status    = getStatus(t);
  const isNative  = t.token === ethers.ZeroAddress;
  const isPending = status === "pending";
  const isExpired = status === "expired";
  
  const now = Math.floor(Date.now() / 1000);
  const isSafetyActive = now < Number(t.deadline);

  let buttonHtml = "";
  if (isPending || isExpired) {
    if (isSafetyActive) {
      buttonHtml = `<button class="btn btn-success" id="claim-btn-${t.id}" disabled style="opacity:0.5;cursor:not-allowed">Claim Locked</button>`;
    } else {
      buttonHtml = `<button class="btn btn-success" id="claim-btn-${t.id}" onclick="handleClaim(${t.id})">Claim Tokens</button>`;
    }
  }

  card.innerHTML = `
    <div class="transfer-card-header">
      <div>
        <div class="transfer-id">Transfer #${t.id}</div>
        <div class="transfer-amount-big" style="margin-top:4px">${formatTransferAmount(t)} ${isNative ? "MON" : "tokens"}</div>
      </div>
      ${statusBadge(status, true)}
    </div>
    <div class="transfer-card-body">
      <div class="transfer-row">
        <span class="transfer-label">From</span>
        <span class="transfer-value mono">${shortAddress(t.sender)}</span>
      </div>
      <div class="transfer-row">
        <span class="transfer-label">Token</span>
        <span class="transfer-value">${isNative ? "Native MON" : shortAddress(t.token)}</span>
      </div>
      <div class="transfer-row">
        <span class="transfer-label">Claimable after</span>
        <span class="transfer-value">${new Date(Number(t.deadline) * 1000).toLocaleString()}</span>
      </div>
    </div>
    <div class="transfer-card-footer">
      <span class="countdown" id="countdown-in-${t.id}">${countdownText(t.deadline)}</span>
      <div id="claim-btn-container-${t.id}">
        ${buttonHtml}
      </div>
    </div>
  `;
  return card;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function handleCancel(id) {
  openModal("Cancel Transfer", "Confirming in wallet…");
  try {
    const tx = await contract.cancel(id);
    updateModal("Waiting…", "Transaction submitted.", tx.hash);
    await tx.wait();
    successModal("Transfer Cancelled", "Your tokens have been refunded.", tx.hash);
    showToast("Transfer cancelled & tokens refunded!", "success");
    loadOutbox();
    loadNativeBalance();
  } catch (err) {
    closeModal();
    if (err.code !== 4001) showToast("Cancel failed: " + shortError(err), "error");
  }
}

async function handleClaim(id) {
  openModal("Claim Tokens", "Confirming in wallet…");
  try {
    const tx = await contract.claim(id);
    updateModal("Waiting…", "Transaction submitted.", tx.hash);
    await tx.wait();
    successModal("Tokens Claimed!", "The tokens are now in your wallet.", tx.hash);
    showToast("Tokens claimed successfully!", "success");
    loadInbox();
    loadNativeBalance();
  } catch (err) {
    closeModal();
    if (err.code !== 4001) showToast("Claim failed: " + shortError(err), "error");
  }
}

async function handleRefundExpired(id) {
  openModal("Reclaim Expired Transfer", "Confirming in wallet…");
  try {
    const tx = await contract.refundExpired(id);
    updateModal("Waiting…", "Transaction submitted.", tx.hash);
    await tx.wait();
    successModal("Tokens Reclaimed!", "Your tokens are back in your wallet.", tx.hash);
    showToast("Expired transfer reclaimed!", "success");
    loadOutbox();
    loadNativeBalance();
  } catch (err) {
    closeModal();
    if (err.code !== 4001) showToast("Reclaim failed: " + shortError(err), "error");
  }
}

// ─── Countdowns ───────────────────────────────────────────────────────────────

function refreshCountdowns() {
  document.querySelectorAll("[id^='countdown-']").forEach(el => {
    const parts     = el.id.split("-");
    const id        = parts[parts.length - 1];
    const type      = parts[1]; // "out" or "in"
    const cardId    = `${type}-card-${id}`;
    const card      = document.getElementById(cardId);
    if (!card) return;

    const deadlineAttr = card.dataset.deadline;
    if (!deadlineAttr) return;

    const text = countdownText(BigInt(deadlineAttr));
    el.textContent = text;

    const secs = Number(BigInt(deadlineAttr)) - Math.floor(Date.now() / 1000);
    el.className = "countdown" + (secs < 300 && secs > 0 ? " urgent" : secs <= 0 ? " expired-label" : "");

    // Dynamically update Claim button state in Inbox
    if (type === "in") {
      const btn = document.getElementById(`claim-btn-${id}`);
      if (btn) {
        if (secs <= 0) {
          if (btn.disabled) {
            btn.disabled = false;
            btn.style.opacity = "";
            btn.style.cursor = "";
            btn.textContent = "Claim Tokens";
            btn.onclick = () => handleClaim(id);
          }
        } else {
          if (!btn.disabled) {
            btn.disabled = true;
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
            btn.textContent = "Claim Locked";
            btn.onclick = null;
          }
        }
      }
    }

    // Dynamically update Cancel button state in Outbox
    if (type === "out") {
      const cancelBtn = card.querySelector(".btn-danger");
      const refundBtn = card.querySelector(".btn-outline");
      if (secs <= 0) {
        if (cancelBtn) cancelBtn.style.display = "none";
        // Reclaim expired fallback button visible after 30 days
        if (secs <= -2592000) {
          if (refundBtn) refundBtn.style.display = "";
        } else {
          if (refundBtn) refundBtn.style.display = "none";
        }
      } else {
        if (cancelBtn) cancelBtn.style.display = "";
        if (refundBtn) refundBtn.style.display = "none";
      }
    }
  });
}

// Store deadline in card dataset
const _origBuildOutbox = buildOutboxCard;
const _origBuildInbox  = buildInboxCard;

// Patch: add dataset.deadline after building
function buildCardWithDeadline(builder, t) {
  const card = builder(t);
  card.dataset.deadline = t.deadline.toString();
  return card;
}

// Override loaders to use patched builder
async function loadOutboxPatched() { return loadOutbox(); }

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function closeMobileMenu() {
  const menuToggle = document.getElementById('menu-toggle');
  const navRight   = document.getElementById('nav-right');
  const topLinks   = document.querySelector('.top-links');
  
  if (menuToggle) menuToggle.classList.remove('active');
  if (navRight) navRight.classList.remove('active');
  if (topLinks) topLinks.classList.remove('active');
}

function switchTab(name, btn) {
  closeMobileMenu();
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));

  document.querySelector(`[data-tab="${name}"]`).classList.add("active");
  document.getElementById(`tab-${name}`).classList.add("active");

  if (name === "outbox") loadOutbox();
  if (name === "inbox")  loadInbox();
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openModal(title, body, txHash) {
  const modal = document.getElementById("tx-modal");
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").textContent  = body;
  document.getElementById("modal-icon").innerHTML    = `<div class="spinner spinner-lg"></div>`;
  document.getElementById("modal-icon").className    = "modal-icon";
  document.getElementById("modal-close-btn").style.display = "none";

  const link = document.getElementById("modal-explorer-link");
  if (txHash) {
    link.href = `${EXPLORER_URL}/tx/${txHash}`;
    link.classList.remove("hidden");
  } else {
    link.classList.add("hidden");
  }

  modal.classList.remove("hidden");
}

function updateModal(title, body, txHash) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").textContent  = body;

  const link = document.getElementById("modal-explorer-link");
  if (txHash) {
    link.href = `${EXPLORER_URL}/tx/${txHash}`;
    link.classList.remove("hidden");
  }
}

function successModal(title, body, txHash) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").textContent  = body;
  document.getElementById("modal-icon").innerHTML    = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>`;
  document.getElementById("modal-icon").className = "modal-icon success";
  document.getElementById("modal-close-btn").style.display = "inline-flex";

  const link = document.getElementById("modal-explorer-link");
  if (txHash) {
    link.href = `${EXPLORER_URL}/tx/${txHash}`;
    link.classList.remove("hidden");
  }
}

function closeModal() {
  document.getElementById("tx-modal").classList.add("hidden");
}

function closeTxModal(e) {
  if (e.target === document.getElementById("tx-modal")) closeModal();
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  const toast     = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      ${type === "success" ? '<path d="M20 6 9 17l-5-5"/>' :
        type === "error"   ? '<path d="M18 6 6 18M6 6l12 12"/>' :
                             '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'}
    </svg>
    <span>${msg}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function updateBadge(id, count) {
  const badge = document.getElementById(id);
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.add("show");
  } else {
    badge.classList.remove("show");
  }
  // Keep dashboard header "Your Pending" stat in sync (outbox pending count)
  if (id === "outbox-badge") {
    const statEl = document.getElementById("stat-pending");
    if (statEl) statEl.textContent = count > 0 ? count : "0";
  }
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatus(t) {
  if (t.claimed)   return "claimed";
  if (t.cancelled) return "cancelled";
  if (BigInt(Math.floor(Date.now() / 1000)) >= t.deadline) return "expired";
  return "pending";
}

function statusBadge(status, isInbox = false) {
  if (status === "claimed")   return `<span class="status-badge status-claimed"><span class="status-dot"></span>Claimed</span>`;
  if (status === "cancelled") return `<span class="status-badge status-cancelled"><span class="status-dot"></span>Cancelled</span>`;
  
  if (status === "expired") {
    return isInbox 
      ? `<span class="status-badge status-claimed" style="background:var(--green-dim);color:var(--green);border-color:rgba(95,216,123,0.2)"><span class="status-dot"></span>Claimable</span>`
      : `<span class="status-badge status-expired"><span class="status-dot"></span>Finalized</span>`;
  }
  
  // Pending
  return isInbox
    ? `<span class="status-badge status-pending" style="background:var(--monad-dim);color:var(--monad-light);border-color:var(--monad-border)"><span class="status-dot"></span>Locked</span>`
    : `<span class="status-badge status-pending"><span class="status-dot"></span>Pending</span>`;
}

function countdownText(deadline) {
  const secs = Number(deadline) - Math.floor(Date.now() / 1000);
  if (secs <= 0) return "Window closed";

  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  if (h > 0) return `${h}h ${m}m remaining`;
  if (m > 0) return `${m}m ${s}s remaining`;
  return `${s}s remaining`;
}

function formatDuration(secs) {
  if (secs >= 86400) return `${secs / 86400} day(s)`;
  if (secs >= 3600)  return `${secs / 3600} hour(s)`;
  if (secs >= 60)    return `${secs / 60} minute(s)`;
  return `${secs} seconds`;
}

function formatTransferAmount(t) {
  try { return Number(ethers.formatEther(t.amount)).toFixed(4); }
  catch { return t.amount.toString(); }
}

function formatAmount(raw, decimals) {
  try { return Number(ethers.formatUnits(raw, decimals)).toFixed(4); }
  catch { return "0"; }
}

function shortAddress(addr) {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function shortError(err) {
  const msg = err?.reason || err?.message || "Unknown error";
  return msg.length > 80 ? msg.slice(0, 80) + "…" : msg;
}
