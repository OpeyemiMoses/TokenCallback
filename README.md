# Token Callback

> Send tokens with a safety window — cancel before the recipient claims it.

Built for the **Spark Hackathon** on [BuildAnything](https://buildanything.so/hackathons/spark), deployed on **Monad**.

---

## The Problem

Sending tokens to the wrong address is permanent and unrecoverable. There's no undo button in crypto.

## The Solution

Token Callback introduces a **timelocked escrow safety layer** between sender and recipient:

1. **Send** → Senders lock native MON or ERC-20 tokens in the contract with a custom safety window.
2. **Guaranteed Safety Window** → During this window, the sender has a 100% guaranteed period to cancel the transfer and receive a full refund. The recipient is locked out from claiming during this window, preventing front-running or races.
3. **Claim** → Once the safety window expires, the sender can no longer cancel, and the recipient can claim the tokens at any time.
4. **Fallback Reclaim** → If the recipient never claims the tokens (e.g. sent to a dead or wrong address), the sender can reclaim them after a 30-day fallback period.

Supports both **native MON** and any **ERC-20 token**.

---

## Project Structure

```
token-callback/
├── contracts/
│   └── TokenCallback.sol      # Core escrow contract
├── scripts/
│   └── deploy.js              # Hardhat deploy script
├── frontend/
│   ├── index.html             # App shell
│   ├── style.css              # Design system
│   └── app.js                 # Wallet + contract logic
├── hardhat.config.js
└── package.json
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Add your deployer private key to .env
```

### 3. Compile the contract

```bash
npm run compile
```

### 4. Deploy to Monad Testnet

Get testnet MON from the [faucet](https://faucet.monad.xyz) first, then:

```bash
npm run deploy:testnet
```

### 5. Wire the frontend

Copy the deployed contract address from the deploy output and paste it into `frontend/app.js`:

```js
const CONTRACT_ADDRESS = "0xYOUR_DEPLOYED_ADDRESS";
```

### 6. Open the frontend

Open `frontend/index.html` in a browser with MetaMask installed. The app will prompt you to switch to Monad Testnet automatically.

---

## Contract

### `TokenCallback.sol`

| Function | Access | Description |
|---|---|---|
| `send(recipient, token, amount, deadline)` | Anyone | Creates escrow transfer with safety window |
| `cancel(id)` | Sender | Cancels and refunds during the safety window |
| `claim(id)` | Recipient | Claims locked tokens after safety window expires |
| `refundExpired(id)` | Sender | Reclaims after 30-day fallback delay if unclaimed |

---

## Tech Stack

- **Smart Contract**: Solidity 0.8.24 + OpenZeppelin 5
- **Chain**: Monad Testnet / Mainnet
- **Frontend**: Vanilla HTML + CSS + JS, ethers.js v6
- **Build**: Hardhat

---

## Hackathon

Built for [Spark](https://buildanything.so/hackathons/spark) — Jul 13–19, 2026
