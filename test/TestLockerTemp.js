const {time, balance} = require('@openzeppelin/test-helpers');
const {ethers} = require('hardhat');
const {expect} = require('chai');
const {toWei} = require('web3-utils');
const {BigNumber} = require('ethers');
const {type} = require('os');

contract('Locker', async () => {

    const TESTERC20 = "TestERC20";
    const LOCKER = "Locker";
    const ERC721_INTERFACE_BYTE = 0x01ffc9a7;
    const SUPPLY = 1000; // This parameter is a value about reward pool
    const APPROVE_NUMBER = "1000";

    async function mintAddress(object, addressName, toWei) {
        return object.mint(addressName, toWei)
    }

    async function getDurationTime(dayNumber) {
        return parseInt(time.duration.days(dayNumber))
    }

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

        CheckOper = await ethers.getContractFactory("CheckPermission");
        checkOper = await CheckOper.deploy(operatable.address);
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
        lock = await Locker.deploy(checkOper.address, firstTestERC20.address, durationTime);
    });

    it('test approve、getApprove、isApprovedOrOwner', async function () {

        // tokenApproveObject(firstTestERC20, owner.address, lock.address, toWei(APPROVE_NUMBER))
        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        firstTokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint
        await firstTestERC20.connect(seObject).approve(lock.address, toWei(APPROVE_NUMBER))
        durationTime = getDurationTime(1)
        secondTokenId = await lock.create_lock_for(SUPPLY, durationTime, seObject.address) // The token id is 2


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


        await lock.approve(secondTokenAddress, 1)

        // Check approves address
        poolTokenAddress = await lock.getApproved(1)
        console.log("STokenAddress::\t" + poolTokenAddress)

        // Determine whether authorization is granted so we know approve object in approves
        needBoolean = await lock.isApprovedOrOwner(secondTokenAddress, 1)
        console.log(checkInfoEq(needBoolean, true))
    });

    it('test function about voter', async function () {

        await firstTestERC20.connect(owner).approve(lock.address, toWei(APPROVE_NUMBER))
        // Call the function create_lock
        durationTime = getDurationTime(1) // Lock one day
        firstTokenId = await lock.create_lock(SUPPLY, durationTime) // This function return a value type is uint
        await firstTestERC20.connect(seObject).approve(lock.address, toWei(APPROVE_NUMBER))
        durationTime = getDurationTime(1)
        secondTokenId = await lock.create_lock_for(SUPPLY, durationTime, seObject.address) // The token id is 2

        //todo test voting

        // Change your voting status
        // initFirstVoteBoolean = await lock.voted(1)
        // assert.equal(initFirstVoteBoolean, false)
        //
        // // Call the function of voting
        // await lock.voting(1)
        // firstVoteBoolean = await lock.voted(1)
        // assert.equal(firstVoteBoolean, true)
        //
        // // Call the function of abstain
        // await lock.abstain(1)
        // firstVoteBoolean = await lock.voted(1)
        // assert.equal(firstVoteBoolean, false)
        //
        // // Call again
        // await lock.voting(1)
        //
        // // Get second locke object vote
        // initSecondVoteBoolea = await lock.voted(2)
        // assert.equal(initSecondVoteBoolea, false)
        //
        // // Convert authorization
        // // Call the function idToOwner
        // seAddress = await lock.ownerOf(2)
        // console.log(seAddress)
        // await lock.setVoter(seAddress)
        // assert.equal(await lock.voter(), seAddress)
        //
        // // Call the function voted
        // seVoteBoolean = await lock.connect(seObject).voted(2)
        // console.log(seVoteBoolean)
        // seVoteBoolean = await lock.voted(2)
        // console.log(seVoteBoolean)
    });


});
