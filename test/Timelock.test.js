const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");

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
        zeroAddress = "0x0000000000000000000000000000000000000000";


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
        assert.equal(await timelock.delay(), "300000");

        assert.equal(await timelock.pendingAdmin(), zeroAddress);
        await timelock.connect(bob).setPendingAdmin(alice.address);
        assert.equal(await timelock.pendingAdmin(), alice.address)


    });

    // it('should not allow non-owner to do operation', async () => {
    //     await testToken.transferOwnership(timelock.address);
    //     await expectRevert(
    //         testToken.transferOwnership(carol.address),
    //         'Ownable: caller is not the owner',
    //     );
    //     await expectRevert(
    //         testToken.connect(bob).transferOwnership(carol.address),
    //         'Ownable: caller is not the owner',
    //     );
    //     await expectRevert(
    //         timelock.queueTransaction(
    //             testToken.address, '0', 'transferOwnership(address)',
    //             encodeParameters(['address'], [carol.address]),
    //             (await time.latest()).add(time.duration.days(4))
    //         ),
    //         'Timelock::queueTransaction: Call must come from admin.',
    //     );
    // });

    // it('should do the timelock thing', async () => {
    //     await testToken.transferOwnership(timelock.address);
    //     const eta = (await time.latest()).add(time.duration.days(4));
    //     awaittimelock.connect(bob).queueTransaction(
    //         testToken.address, '0', 'transferOwnership(address)',
    //         encodeParameters(['address'], [carol.address]), eta
    //     );
    //     await time.increase(time.duration.days(1));
    //     await expectRevert(
    //        timelock.connect(bob).executeTransaction(
    //             testToken.address, '0', 'transferOwnership(address)',
    //             encodeParameters(['address'], [carol.address]), eta
    //         ),
    //         "Timelock::executeTransaction: Transaction hasn't surpassed time lock.",
    //     );
    //     await time.increase(time.duration.days(4));
    //     awaittimelock.connect(bob).executeTransaction(
    //         testToken.address, '0', 'transferOwnership(address)',
    //         encodeParameters(['address'], [carol.address]), eta
    //     );
    //     assert.equal((await testToken.owner()).valueOf(), carol.address);
    // });
    // it('test cancelTransaction', async () => {
    //     assert.equal(await testToken.owner().valueOf(), alice.address);
    //     await testToken.transferOwnership(timelock.address);
    //     assert.equal(await testToken.owner().valueOf(),timelock.address);
    //
    //     let eta = (await time.latest()).add(time.duration.days(4));
    //     awaittimelock.connect(bob).queueTransaction(
    //         testToken.address, '0', 'transferOwnership(address)',
    //         encodeParameters(['address'], [carol.address]), eta
    //     );
    //     await time.increase(time.duration.days(1));
    //
    //     eta = (await time.latest()).add(time.duration.days(4));
    //
    //     awaittimelock.connect(bob).cancelTransaction(
    //         testToken.address, '0', 'transferOwnership(address)',
    //         encodeParameters(['address'], [carol.address]), eta
    //     );
    //     assert.equal(await testToken.owner().valueOf(),timelock.address);
    //
    //
    // });
    // it("test acceptAdmin", async () => {
    //     assert.equal(awaittimelock.pendingAdmin(), alice.address);
    //     awaittimelock.acceptAdmin();
    //     assert.equal(awaittimelock.pendingAdmin(), zeroAddress);
    //
    //
    // });
    // it("test setPendingAdmin",async () => {
    //
    //     expect(awaittimelock.adminInitialized()).to.be.eq(true)
    //
    //     // await timelock.acceptAdmin()
    //     //         expect(awaittimelock.adminInitialized()).to.be.eq(true)
    //
    //      let eta = (await time.latest()).add(time.duration.days(4));
    //  awaittimelock.connect(bob).queueTransaction(
    //        timelock.address, '0', 'setPendingAdmin(address)',
    //         encodeParameters(['address'],
    //             [bob.address]), eta
    //     );
    //     await time.increase(time.duration.days(4));
    //     awaittimelock.connect(bob).executeTransaction(
    //        timelock.address, '0', 'setPendingAdmin(address)',
    //         encodeParameters(['address'],
    //             [bob.address]), eta,
    //     );
    //
    //         await timelock.connect(bob).acceptAdmin()
    //
    //       //  expect(awaittimelock.pendingAdmin()).to.be.eq(bob);
    //
    // })


});
