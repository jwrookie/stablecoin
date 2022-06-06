const {ethers, waffle} = require("hardhat");
const {expectRevert, time} = require('@openzeppelin/test-helpers');

const {expect} = require("chai");

function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}
contract('Operatable', () => {
    beforeEach(async () => {

        [owner, dev, addr1] = await ethers.getSigners();
        const testOperatable = await ethers.getContractFactory('Operatable');
        operatable = await testOperatable.deploy();

        const CheckPermission = await ethers.getContractFactory("CheckPermission");
        checkPermission = await CheckPermission.deploy(operatable.address);
        zeroAddr = "0x0000000000000000000000000000000000000000";

    });

    it('test setOperator', async () => {
        expect(await operatable.operator()).to.be.eq(owner.address);
        await operatable.setOperator(dev.address);
        expect(await operatable.operator()).to.be.eq(dev.address);

    });

    it('test transferOwnership', async () => {
        expect(await operatable.owner()).to.be.eq(owner.address);

        await operatable.transferOwnership(dev.address);
        expect(await operatable.owner()).to.be.eq(dev.address);
    });

    it('test renounceOwnership', async () => {
        expect(await operatable.owner()).to.be.eq(owner.address);
        await operatable.renounceOwnership();
        expect(await operatable.owner()).to.be.eq(zeroAddr);
    });
    it("test addContract and removeContract", async () => {

        expect(await operatable.contractWhiteList(owner.address)).to.be.eq(false);
        await expect(operatable.connect(dev).addContract(owner.address)).to.be.revertedWith("not operator");
        await operatable.addContract(owner.address);

        expect(await operatable.contractWhiteList(owner.address)).to.be.eq(true);

        expect(await operatable.check(owner.address)).to.be.eq(true);
        await operatable.removeContract(owner.address);

        expect(await operatable.contractWhiteList(owner.address)).to.be.eq(false);


    });
    it("test setOperContract", async () => {
        expect(await checkPermission.owner()).to.be.eq(owner.address);
        expect(await checkPermission.operator()).to.be.eq(owner.address);
        expect(await checkPermission.operatable()).to.be.eq(operatable.address);

        await expect(checkPermission.connect(dev).setOperContract(dev.address)).to.be.revertedWith("Ownable: caller is not the owner");
        await checkPermission.setOperContract(dev.address)
        expect(await checkPermission.operatable()).to.be.eq(dev.address);


    });
    it("test togglePause", async () => {
        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);

        expect(await fxs.paused()).to.be.eq(false);

        await fxs.togglePause();
        expect(await fxs.paused()).to.be.eq(true);

        await fxs.togglePause();
        expect(await fxs.paused()).to.be.eq(false);


    });


});