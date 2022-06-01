const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");

function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract('Timelock', () => {
    beforeEach(async () => {
        [alice, bob, carol] = await ethers.getSigners();
        const TestOwnableToken = await ethers.getContractFactory('TestOwnableToken');
        testToken = await TestOwnableToken.deploy();

        const Timelock = await ethers.getContractFactory('Timelock');
        timelock = await Timelock.deploy(bob.address, "259200");
        zeroAddress = "0x0000000000000000000000000000000000000000"

        let eta = (await time.latest()).add(time.duration.days(4));
        await timelock.connect(bob).queueTransaction(
            timelock.address, '0', 'setDelay(uint256)',
            encodeParameters(['uint256'],
                ['300000']), parseInt(eta)
        );
        await time.increase(time.duration.days(4));
        await timelock.connect(bob).executeTransaction(
            timelock.address, '0', 'setDelay(uint256)',
            encodeParameters(['uint256'],
                ['300000']), parseInt(eta)
        );
        expect(await timelock.delay()).to.be.eq("300000");

        expect(await timelock.pendingAdmin()).to.be.eq(zeroAddress);
        await timelock.connect(bob).setPendingAdmin(alice.address);
        expect(await timelock.pendingAdmin()).to.be.eq(alice.address)


    });
    it('should not allow non-owner to do operation', async () => {
        await testToken.transferOwnership(timelock.address);
        await expect(
            testToken.transferOwnership(carol.address)
        ).to.be.revertedWith('Ownable: caller is not the owner');
        await expect(
            testToken.connect(bob).transferOwnership(carol.address)
        ).to.be.revertedWith('Ownable: caller is not the owner');
        let date = (await time.latest()).add(time.duration.days(4));
        await expect(
            timelock.queueTransaction(
                testToken.address, '0', 'transferOwnership(address)',
                encodeParameters(['address'], [carol.address]),
                parseInt(date)
            )
        ).to.be.revertedWith('Timelock::queueTransaction: Call must come from admin');
    });

    it('should do the timelock thing', async () => {
        await testToken.transferOwnership(timelock.address);
        const eta = (await time.latest()).add(time.duration.days(4));
        await timelock.connect(bob).queueTransaction(
            testToken.address, '0', 'transferOwnership(address)',
            encodeParameters(['address'], [carol.address]), parseInt(eta)
        );
        await time.increase(time.duration.days(1));
        await expect(
            timelock.connect(bob).executeTransaction(
                testToken.address, '0', 'transferOwnership(address)',
                encodeParameters(['address'], [carol.address]), parseInt(eta)
            )
        ).to.be.revertedWith(
            "Timelock::executeTransaction: Transaction hasn't surpassed time lock");
        await time.increase(time.duration.days(4));
        await timelock.connect(bob).executeTransaction(
            testToken.address, '0', 'transferOwnership(address)',
            encodeParameters(['address'], [carol.address]), parseInt(eta)
        );
        expect(await testToken.owner().valueOf()).to.be.eq(carol.address);
    });
    it('test cancelTransaction', async () => {
        expect(await testToken.owner().valueOf()).to.be.eq(alice.address);
        await testToken.transferOwnership(timelock.address);
        expect(await testToken.owner().valueOf()).to.be.eq(timelock.address);

        let eta = (await time.latest()).add(time.duration.days(4));
        await timelock.connect(bob).queueTransaction(
            testToken.address, '0', 'transferOwnership(address)',
            encodeParameters(['address'], [carol.address]), parseInt(eta)
        );
        await time.increase(time.duration.days(1));

        eta = (await time.latest()).add(time.duration.days(4));

        await timelock.connect(bob).cancelTransaction(
            testToken.address, '0', 'transferOwnership(address)',
            encodeParameters(['address'], [carol.address]), parseInt(eta)
        );
        expect(await testToken.owner().valueOf()).to.be.eq(timelock.address);


    });
    it("test acceptAdmin", async () => {
        expect(await timelock.pendingAdmin()).to.be.eq(alice.address);
        await timelock.acceptAdmin();
        expect(await timelock.pendingAdmin()).to.be.eq(zeroAddress);


    });



});
