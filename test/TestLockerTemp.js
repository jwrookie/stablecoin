/**
 * @description: This is the unit test case for the locker contract
 * @author: Lucifer
 * @data: 2022/04/12 14:21
 */
/** Introducing external modules */
const {time, balance} = require('@openzeppelin/test-helpers');
const {ethers} = require('hardhat');
const {expect} = require('chai');
const {toWei} = require('web3-utils');
const {BigNumber} = require('ethers');
const {type} = require('os');

contract('Locker', async () => {
    /**
     * This contract we need two object to which is implement interface ERC721 or ERC165
     */
        // Introducing constant
    const TESTERC20 = "TestERC20";
    const LOCKER = "Locker";
    const ERC721_INTERFACE_BYTE = 0x01ffc9a7;
    const SUPPLY = 1000; // This parameter is a value about reward pool
    const APPROVE_NUMBER = "1000";

    // Intfoducing letibale
    let TestERC20
    let Locker
    let firstTestERC20;
    let seTestERC20;
    let thTestERC20;
    let durationTime;
    let lock;

    /**
     * To mint some object
     * @param {Contract} object
     * @param {Address} addressName
     * @param {Any} toWei
     * @returns
     */
    async function mintAddress(object, addressName, toWei) {
        return object.mint(addressName, toWei)
    }

    /**
     * Get duration time
     * @param {Number} dayNumber
     * @returns
     */
    async function getDurationTime(dayNumber) {
        if (0 >= durationTime || durationTime > 100) {
            return
        }
        return parseInt(time.duration.days(dayNumber))
    }

    /**
     * This is a function about check information equal information
     * @param {Any} anyThing
     * @param {Any} value
     * @returns
     */
    async function checkInfoEq(anyThing, value) {
        if ("" == anyThing || null == anyThing) {
            return
        }
        if ("" == value || null == value) {
            return
        }
        if (expect(value).to.be.eq(value)) {
            return true
        } else {
            return false
        }
    }

    beforeEach(async function () {
        [owner, seObject] = await ethers.getSigners();
        const TestERC20 = await ethers.getContractFactory(TESTERC20);
        const Locker = await ethers.getContractFactory(LOCKER);

        const Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();
        // Deploy contract
        firstTestERC20 = await TestERC20.deploy();
        seTestERC20 = await TestERC20.deploy();
        thTestERC20 = await TestERC20.deploy();

        // Mint value
        mintAddress(firstTestERC20, owner.address, toWei("1"));
        mintAddress(seTestERC20, owner.address, toWei("1"));
        mintAddress(thTestERC20, owner.address, toWei("1"));

        // Mint some initial value
        durationTime = getDurationTime(1);
        lock = await Locker.deploy(operatable.address, firstTestERC20.address, durationTime);
    });

    it('test approve、getApprove、isApprovedOrOwner', async function () {
        /**
         * You need to craete lock twice, because this function definition can not empower yourself
         * Focus on the one modifled map ---> idToApproves
         */
        let firstTokenId
        let firstTokenAddress
        let secondTokenId
        let secondTokenAddress
        let poolTokenAddress
        let needBoolean
        let tokenIndex
        let seTokenIndex

        // tokenApproveObject(firstTestERC20, owner.address, lock.address, toWei(APPROVE_NUMBER))
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        firstTokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint
        await firstTestERC20.connect(seObject).approve(lock.address, toWei(APPROVE_NUMBER))
        durationTime = getDurationTime(1)
        secondTokenId = await lock.create_lock_for(SUPPLY, durationTime, seObject.address) // The token id is 2
        /**
         *  Each user can authorize the pool only once
         */

        tokenIndex = await lock.balanceOf(firstTestERC20.address)
        console.log("TokenIndex::\t" + tokenIndex)
        firstTokenId = await lock.tokenOfOwnerByIndex(firstTestERC20.address, tokenIndex)
        console.log("firstTokenId::\t" + firstTokenId)

        seTokenIndex = await lock.connect(seObject).balanceOf(firstTestERC20.address)
        console.log("SeTokenIndex::\t" + seTokenIndex)
        secondTokenId = await lock.connect(seObject).tokenOfOwnerByIndex(firstTestERC20.address, seTokenIndex)
        console.log("SeTokenId::\t" + secondTokenId)

        // We use the second token to authorize the first token
        firstTokenAddress = await lock.ownerOf(1)
        console.log("FTokenAddress::\t" + firstTokenAddress)
        secondTokenAddress = await lock.ownerOf(2)

        /**
         * You must ensure that this address is present in the lock pool and is not self-authorized
         * This parameter is the authorized object
         */
        await lock.approve(secondTokenAddress, 1)

        // Check approves address
        poolTokenAddress = await lock.getApproved(1)
        console.log("STokenAddress::\t" + poolTokenAddress)

        // Determine whether authorization is granted so we know approve object in approves
        needBoolean = await lock.isApprovedOrOwner(secondTokenAddress, 1)
        console.log(checkInfoEq(needBoolean, true))
    });

    it('test function about voter', async function () {
        let firstTokenId
        let secondTokenId
        let initFirstVoteBoolean
        let firstVoteBoolean
        let initSecondVoteBoolea
        let seVoteBoolean
        let seAddress

        // tokenApproveObject(firstTestERC20, owner.address, lock.address, toWei(APPROVE_NUMBER))
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        firstTokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint
        await firstTestERC20.connect(seObject).approve(lock.address, toWei(APPROVE_NUMBER))
        durationTime = getDurationTime(1)
        secondTokenId = await lock.create_lock_for(SUPPLY, durationTime, seObject.address) // The token id is 2

        // Change your voting status
        initFirstVoteBoolean = await lock.voted(1)
        assert.equal(initFirstVoteBoolean, false)

        // Call the function of voting
        await lock.voting(1)
        firstVoteBoolean = await lock.voted(1)
        assert.equal(firstVoteBoolean, true)

        // Call the function of abstain
        await lock.abstain(1)
        firstVoteBoolean = await lock.voted(1)
        assert.equal(firstVoteBoolean, false)

        // Call again
        await lock.voting(1)

        // Get second locke object vote
        initSecondVoteBoolea = await lock.voted(2)
        assert.equal(initSecondVoteBoolea, false)

        // Convert authorization
        // Call the function idToOwner
        seAddress = await lock.ownerOf(2)
        console.log(seAddress)
        await lock.setVoter(seAddress)
        assert.equal(await lock.voter(), seAddress)

        // Call the function voted
        seVoteBoolean = await lock.connect(seObject).voted(2)
        console.log(seVoteBoolean)
        // seVoteBoolean = await lock.voted(2)
        // console.log(seVoteBoolean)
    });


});
