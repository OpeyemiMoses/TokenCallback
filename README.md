# CallBack — Timelocked Escrow Safety Protocol

> Send tokens with a safety window — cancel and get 100% refunds before the recipient is allowed to claim.

Built for the **Spark Hackathon** (July 13–19, 2026) and deployed on **Monad**.

* **Deployed Contract Address:** [`0x2Cb084E68ef4e6a9cA0512Bd5f722ADe672F36Be`](https://monadscan.com/address/0x2Cb084E68ef4e6a9cA0512Bd5f722ADe672F36Be)
* **Monad Mainnet Explorer:** [View Contract on Explorer](https://monadscan.com/address/0x2Cb084E68ef4e6a9cA0512Bd5f722ADe672F36Be)

---

## 👁️ Vision & Thesis

**The Thesis:** Blockchain transactions are famously final. While immutability is a core strength of decentralized ledger systems, it is also the single greatest friction point for mainstream user adoption. Every day, Web3 users lose millions of dollars due to clipboard-hijacking malware, phishing links, and simple fat-finger typos. The fear of permanent loss forces users to send low-value "test transactions," wasting time and gas fees.

**The Vision:** CallBack humanizes Web3 UX by inserting a non-custodial, decentralized safety buffer between senders and recipients. By defaulting to a transaction with a customizable "safety window," senders gain the peace of mind that they can cancel and recall their tokens at any point if they realize an error was made. Once the window expires, ownership shifts irrevocably, giving the recipient standard finality. This bridges the gap between traditional banking consumer protections and Web3's absolute self-sovereign finality.

---

## 🚨 Detailed Problem & Solution

### The Problem
1. **Unforgiving Finality:** Traditional EVM transfers push tokens instantly to the target address. If sent to the wrong address, the funds are gone forever.
2. **Clipboard Hijacking Malware:** Malicious software monitors user clipboards and swaps copied recipient addresses with the attacker's address. Users who do not carefully inspect every single digit of the hexadecimal string are phished.
3. **The Race-Condition Risk:** If a sender realizes they sent tokens to a wrong address, they are in a race against the recipient. If the recipient is a monitoring bot or a hostile actor, they will immediately claim/move the funds, making recovery impossible even if the sender acts within seconds.

### The Solution: CallBack
1. **Decentralized Escrow Buffer:** Senders lock native MON or ERC-20 tokens in a secure, audited, gas-optimized smart contract rather than pushing them directly to the recipient.
2. **Guaranteed Revocation Period:** The sender has absolute, cryptographic authority to cancel the transaction and withdraw 100% of the locked funds back to their wallet at any time during the safety window.
3. **Timelocked Claims:** To eliminate race conditions, the recipient's claim capability is locked until the safety window expires. The recipient cannot front-run or race to claim the funds.
4. **Dead Address Recovery (Fallback Delay):** If tokens are sent to a dead address or the recipient never claims them, the sender can retrieve them after a 30-day fallback delay (`FALLBACK_DELAY`), ensuring capital is never permanently locked or burned.

---

## ⚡ Key Features

* **100% Guaranteed Cancellation:** Senders can cancel and refund transfers during the active safety window.
* **Timelocked Recipient Claims:** Recipients can only claim tokens *after* the safety window has expired, preventing front-running races.
* **Token Agnostic:** Out-of-the-box support for native `MON` and any standard `ERC-20` token (e.g. USDT, USDC, WMON).
* **Self-Send Prevention:** Built-in client validation prevents accidentally sending tokens to your own address.
* **Trybind Visual Aesthetic:** Custom-styled dark-theme UI featuring smooth CSS animations, floating browser mockups, mobile-responsive hamburger menus, and Monad brand coloring.
* **Dynamic Countdown Loop:** Frontend dynamically monitors block-time offsets and automatically unlocks the "Claim" button when the safety window expires without requiring page reloads.
* **Free Public Good:** The smart contract charges zero protocol fees or administration taxes.

---

## 🛠️ Tech Stack & Frameworks

* **Smart Contract Layer:** Solidity `0.8.24`, OpenZeppelin Contracts v5 (utilizing `ReentrancyGuard` and `SafeERC20`).
* **Development & Build System:** Hardhat Development Environment, EDR node provider.
* **Testing Suite:** Chai Assertion Library, Mocha Test Runner.
* **Frontend Application:** Vanilla HTML5, CSS3 Custom Variables, ES6 JavaScript.
* **Blockchain Connection Library:** Ethers.js v6.

---

## 📋 Project Structure

```
token-callback/
├── .agents/
│   └── AGENTS.md              # Project rules & deployment reminders
├── contracts/
│   └── TokenCallback.sol      # Main Timelocked Escrow Contract
├── scripts/
│   └── deploy.js              # Hardhat Monad deployment script
├── frontend/
│   ├── index.html             # Landing page with interactive mockups
│   ├── dashboard.html         # Active dApp dashboard
│   ├── style.css              # Main design tokens & base CSS
│   ├── landing.css            # Landing page layout & animations
│   ├── dashboard.css          # Dashboard grids & separate transaction cards
│   └── app.js                 # Frontend contract & wallet logics
├── test/
│   └── TokenCallback.test.js  # Timelock & claim unit test suite
├── hardhat.config.js          # Hardhat compiler configurations
├── package.json
└── README.md
```

---

## ⚙️ Environment Configuration Reference

The project uses a standard `.env` file to manage deployment parameters. Create a `.env` file in the root directory:

```env
# Private key of the account deploying the contracts
PRIVATE_KEY="0x..."
```

---

## 💻 Running Locally

### 1. Clone the project and install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
# Open .env and add your private key
```

### 3. Compile the Solidity contract
```bash
npm run compile
```

### 4. Run the Hardhat unit test suite
```bash
npm run test
```

### 5. Deploy to Monad Testnet
```bash
npm run deploy:testnet
```

### 6. Run the Frontend locally
Simply serve the files using a local server or open `frontend/index.html` directly in your browser. Make sure you have a Web3 browser wallet (e.g. MetaMask, Rabby) set to Monad Mainnet.

---

## 🤖 Future Roadmap & AI Integration

1. **AI Safety Scoring Agent (Models):** Integrate an off-chain light machine learning classification model to analyze recipient address histories. It will flag brand-new addresses, zero-transaction addresses, or high-risk smart contracts, automatically recommending safety windows (e.g., advising a longer safety window for high-risk flags).
2. **Keeper Automation:** Integrate Chainlink Keepers or Gelato Network to automatically push the tokens directly to the recipient's wallet once the safety window expires, saving the recipient from paying claim gas.
3. **Batch Escrows:** Allow users to send multiple timelocked escrows to separate addresses in a single batch transaction.
4. **Conditional Safety Windows:** Senders can bind the safety window to off-chain triggers or state APIs (e.g. oracle feedbacks).

---

## 🏆 Hackathon Submission Details

* **Hackathon:** Built for the [Spark Hackathon](https://buildanything.so/hackathons/spark) (July 13–19, 2026).
* **Category:** DeFi & Consumer Usability / UX Innovations.
* **Target Network:** Monad Mainnet.
* **EVM Contract Address:** `0x2Cb084E68ef4e6a9cA0512Bd5f722ADe672F36Be`

---

## 📄 License

This project is licensed under the **MIT License**.

```
Copyright (c) 2026 Opeyemi Moses

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```
