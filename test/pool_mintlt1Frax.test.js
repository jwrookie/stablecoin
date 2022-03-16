const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {toWei} = web3.utils;
const Factory = require('../test/mock/PancakeFactory.json');
const Pair = require('../test/mock/PancakePair.json');
const Router = require('../test/mock/PancakeRouter.json');
const WETH = require('../test/mock/WETH9.json');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract('Pool_USDC', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        const TestERC20 = await ethers.getContractFactory('TestERC20');
        usdc = await TestERC20.deploy();
        busd = await TestERC20.deploy();
        // weth = await TestERC20.deploy();
          weth = await deployContract(owner, {
        bytecode: WETH.bytecode,
        abi: WETH.abi,
    });

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const Timelock = await ethers.getContractFactory('Timelock');
        timelock = await Timelock.deploy(owner.address, "259200");

        const FRAXShares = await ethers.getContractFactory('FRAXShares');
        fxs = await FRAXShares.deploy("Test", "Test", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('FRAXStablecoin');
        frax = await FRAXStablecoin.deploy("usdc", "usdc");
        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);

        assert.equal(await fxs.oracle(), oracle.address);
        assert.equal(await frax.fxsAddress(), fxs.address);

        const FraxPoolLibrary = await ethers.getContractFactory('FraxPoolLibrary')
        fraxPoolLibrary = await FraxPoolLibrary.deploy();

        const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
            libraries: {
                FraxPoolLibrary: fraxPoolLibrary.address,
            },
        });
        pool = await Pool_USDC.deploy(frax.address, fxs.address, usdc.address, 100);
        assert.equal(await pool.USDC_address(), usdc.address)


        const MockChainLink = await ethers.getContractFactory("MockChainLink");
        chainLink = await MockChainLink.deploy();


        const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
        chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);
        await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address)

        assert.equal(await fxs.balanceOf(owner.address), toWei('100000000'));
        assert.equal(await frax.balanceOf(owner.address), toWei('2000000'));
        await usdc.mint(owner.address, toWei('1'))




        // await usdc.approve(router.address, toWei('1000'))
        // await busd.approve(router.address, toWei('1000'))
        // await usdc.mint(owner, toWei('100'))
        // await busd.mint(owner, toWei('100'))
        // await usdc.mint(pool.address, toWei('1'))

        await frax.approve(pool.address,toWei('1000'))
         await fxs.approve(pool.address,toWei('1000'))
        await usdc.approve(pool.address,toWei('1000'))
        await frax.addPool(pool.address);

        factory = await deployContract(owner, {
            bytecode: Factory.bytecode,
            abi: Factory.abi
        }, [owner.address]);
       // console.log("factory:" + factory.address)

             pair = await deployContract(owner, {
            bytecode: Pair.bytecode,
            abi: Pair.abi
        });

        router = await deployContract(owner, {
            bytecode: Router.bytecode,
            abi: Router.abi
        }, [factory.address, weth.address]);
       // console.log("router:" + router.address)

         await factory.createPair(usdc.address, busd.address)
        pairAddr = await factory.getPair(usdc.address, busd.address)
        // console.log("pair:" + pairAddr)
        usdc_busd = await pair.attach(pairAddr)
        assert.equal(usdc_busd.address,pairAddr)



        await usdc.approve(router.address, toWei('1000'))
        await busd.approve(router.address, toWei('1000'))
        await usdc.mint(owner.address, toWei('100'))
        await busd.mint(owner.address, toWei('100'))


        await router.addLiquidity(
            usdc.address,
            busd.address,
            toWei('1'),
            toWei('1'),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 1000)

        )

        const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
        uniswapOracle = await UniswapPairOracle.deploy(factory.address,usdc.address,busd.address,owner.address,timelock.address);
        //await pool.setCollatETHOracle(uniswapOracle.address,weth.address)


    });

    it('test mint1t1FRAX ', async () => {
        //console.log("ethUsdPrice:" + await frax.ethUsdPrice())
        //console.log("getCollateralPrice:"+await pool.getCollateralPrice())
        // assert.equal(await usdc.balanceOf(pool.address), 0)
        // assert.equal(await pool.unclaimedPoolCollateral(), 0)

        console.log("ethUsdPrice:"+await frax.ethUsdPrice())
        await chainLink.setAnswer(100)
        let info = await chainLink.getRoundData(0)
       // await pool.mint1t1FRAX("10", 0)
        // // let a =  await fraxPoolLibrary.calcMint1t1FRAX(1,toWei('1'))
        // //  console.log("calcMint1t1FRAX:"+a)
        //  console.log("frax"+await frax.balanceOf(owner))
        //   console.log("usdc pool"+await usdc.balanceOf(pool.address))
        //   console.log("usdc owner"+await usdc.balanceOf(owner))


        console.log("roundId:"+info[0])
         console.log("answer:"+info[1])
         console.log("startedAt:"+info[2])
         console.log("updatedAt:"+info[3])
         console.log("answeredInRound:"+info[4])

    });


});
