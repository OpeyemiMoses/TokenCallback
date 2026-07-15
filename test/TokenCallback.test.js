const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenCallback Timelocked Logic", function () {
  let TokenCallback;
  let tokenCallback;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    TokenCallback = await ethers.getContractFactory("TokenCallback");
    tokenCallback = await TokenCallback.deploy();
  });

  it("should enforce sender can cancel during safety window but recipient cannot claim", async function () {
    const amount = ethers.parseEther("1.0");
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = latestBlock.timestamp + 3600; // 1 hour in future

    // Send native MON from addr1 to addr2
    await tokenCallback.connect(addr1).send(
      addr2.address,
      ethers.ZeroAddress,
      amount,
      deadline,
      { value: amount }
    );

    // Recipient tries to claim during safety window -> should revert
    await expect(
      tokenCallback.connect(addr2).claim(0)
    ).to.be.revertedWithCustomError(tokenCallback, "SafetyWindowActive");

    // Sender cancels during safety window -> should succeed
    await expect(
      tokenCallback.connect(addr1).cancel(0)
    ).to.emit(tokenCallback, "TransferCancelled").withArgs(0, addr1.address);
  });

  it("should enforce recipient can claim after safety window but sender cannot cancel", async function () {
    const amount = ethers.parseEther("1.0");
    const latestBlock = await ethers.provider.getBlock("latest");
    const deadline = latestBlock.timestamp + 5; // 5 seconds in future

    // Send native MON
    await tokenCallback.connect(addr1).send(
      addr2.address,
      ethers.ZeroAddress,
      amount,
      deadline,
      { value: amount }
    );

    // Wait for safety window to expire
    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine");

    // Sender tries to cancel after safety window -> should revert
    await expect(
      tokenCallback.connect(addr1).cancel(0)
    ).to.be.revertedWithCustomError(tokenCallback, "SafetyWindowExpired");

    // Recipient claims after safety window -> should succeed
    const initialRecipientBalance = await ethers.provider.getBalance(addr2.address);
    const tx = await tokenCallback.connect(addr2).claim(0);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;

    const finalRecipientBalance = await ethers.provider.getBalance(addr2.address);
    expect(finalRecipientBalance).to.equal(initialRecipientBalance + amount - gasUsed);
  });
});
