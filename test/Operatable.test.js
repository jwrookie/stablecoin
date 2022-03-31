/**
 * @description:
 * @author: Lucifer
 */
const {expectRevert, time} = require('@openzeppelin/test-helpers');

 contract('Operatable', ([owner, secondOwner, thirdOwner]) => {
    beforeEach(async () => {
        const testOperatable = await ethers.getContractFactory('Operatable');
        operatable = await testOperatable.deploy();
    });

    it('test Operatable', async () => {
        // First
        // assert.equal(await operatable.owner(), await operatable.setOperator());
        // Use function
        await operatable.setOperator(secondOwner);
        assert.equal(await operatable.operator(), secondOwner);
    });

    it('test Ownable', async () => {
        // Test owner function
        assert.equal(await operatable.owner(), owner);

        await operatable.transferOwnership(secondOwner)
        
        // Test transferOwnership function
        assert.equal(await operatable.owner(), secondOwner);
    });

    it('test Ownable remove', async () => {
        // Test renounceOwnership function
        await operatable.renounceOwnership();

        // Use assertions to determine if the result meets expectations
        assert.equal(await operatable.owner(), 0);
    });
 });