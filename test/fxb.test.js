const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {toWei} = web3.utils;
const Factory = require('../test/mock/PancakeFactory.json');
const Pair = require('../test/mock/PancakePair.json');
const Router = require('../test/mock/PancakeRouter.json');
const WETH = require('../test/mock/WETH9.json');
const {BigNumber} = require('ethers');
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract('FraxBond', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        const TestERC20 = await ethers.getContractFactory('TestERC20');
        usdc = await TestERC20.deploy();
        busd = await TestERC20.deploy();
        weth = await deployContract(owner, {
            bytecode: WETH.bytecode,
            abi: WETH.abi,
        });

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const Timelock = await ethers.getContractFactory('Timelock');
        timelock = await Timelock.deploy(owner.address, "259200");

        const FRAXShares = await ethers.getContractFactory('FRAXShares');
        fxs = await FRAXShares.deploy("fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('FRAXStablecoin');
        frax = await FRAXStablecoin.deploy("frax", "frax");
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
        pool = await Pool_USDC.deploy(frax.address, fxs.address, usdc.address, toWei('100'));
        assert.equal(await pool.USDC_address(), usdc.address);


        const MockChainLink = await ethers.getContractFactory("MockChainLink");
        chainLink = await MockChainLink.deploy();

        const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
        chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);
        await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);

        await chainLink.setAnswer(toWei('100'));

        assert.equal(await fxs.balanceOf(owner.address), toWei('100000000'));
        assert.equal(await frax.balanceOf(owner.address), toWei('2000000'));
        await usdc.mint(owner.address, toWei('1'));

        await frax.approve(pool.address, toWei('1000'));
        await fxs.approve(pool.address, toWei('1000'));
        await usdc.approve(pool.address, toWei('1000'));
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

        await factory.createPair(usdc.address, weth.address);
        pairAddr = await factory.getPair(usdc.address, weth.address);
        // console.log("pair:" + pairAddr)
        usdc_busd = await pair.attach(pairAddr);
        assert.equal(usdc_busd.address, pairAddr);

        await usdc.approve(router.address, toWei('1000'));
        await weth.approve(router.address, toWei('1000'));
        await usdc.mint(owner.address, toWei('100'));
        //await busd.mint(owner.address, toWei('100'))
        await weth.deposit({value: toWei('100')});
        assert.equal(await weth.balanceOf(owner.address), toWei('100'));

        await router.addLiquidity(
            usdc.address,
            weth.address,
            toWei('1'),
            toWei('0.0001'),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 1000)
        );

        const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
        uniswapOracle = await UniswapPairOracle.deploy(factory.address, usdc.address, weth.address, owner.address, timelock.address);
        await pool.setCollatETHOracle(uniswapOracle.address, weth.address);

        await frax.setFRAXEthOracle(uniswapOracle.address, weth.address);
        assert.equal(await frax.fraxEthOracleAddress(), uniswapOracle.address);

        await frax.setFXSEthOracle(uniswapOracle.address, weth.address);
        assert.equal(await frax.fxsEthOracleAddress(), uniswapOracle.address);


        const FraxBond = await ethers.getContractFactory("FraxBond");
        fxb = await FraxBond.deploy("fxb", "fxb");

        const FraxBondIssuer = await ethers.getContractFactory('FraxBondIssuer');
        fraxBondIssuer = await FraxBondIssuer.deploy(frax.address, fxb.address);
        // console.log("fraxBondIssuer:"+fraxBondIssuer.address)

        assert.equal(await fraxBondIssuer.stableCoin(), frax.address);
        assert.equal(await fraxBondIssuer.bond(), fxb.address);

    });

    it('test addIssuer and removeIssuer  ', async () => {
        assert.equal(await fxb.bond_issuers(owner.address), false);
        await fxb.addIssuer(owner.address);
        assert.equal(await fxb.bond_issuers(owner.address), true);
        assert.equal(await fxb.balanceOf(fraxBondIssuer.address), 0);

        await fxb.issuer_mint(fraxBondIssuer.address, "200000");
        await fxb.issuer_mint(owner.address, "100000");
        assert.equal(await fxb.balanceOf(fraxBondIssuer.address), "200000");
        assert.equal(await fxb.balanceOf(owner.address), "100000");

        await fxb.issuer_burn_from(fraxBondIssuer.address, "100000");
        assert.equal(await fxb.balanceOf(fraxBondIssuer.address), "100000");

        await fxb.removeIssuer(owner.address);
        assert.equal(await fxb.bond_issuers(owner.address), false);

    });
    it('test mintBond ', async () => {
        await fxb.addIssuer(fraxBondIssuer.address);
        await fxb.addIssuer(owner.address);

        await frax.approve(fraxBondIssuer.address, toWei('10000'));
        await fxb.approve(fraxBondIssuer.address, toWei('10000'));
        //await frax.approve(pool.address, toWei('1000000000000000000000000000'));
        await frax.addPool(fraxBondIssuer.address);

        // await fraxBondIssuer.setRangeInterestRate(toWei('0.01'), toWei('1000000000000000000'));

        //  await fraxBondIssuer.setInterestRate(toWei('19000000000000000'));
        console.log("fxb:" + await fxb.balanceOf(owner.address))
        console.log("frax:" + await frax.balanceOf(owner.address))
        console.log("exchangeRate:" + await fraxBondIssuer.exchangeRate())
        console.log("------------------------")
        // await frax.transfer(fraxBondIssuer.address,1000)

        //await pool.mint1t1FRAX(1000,1000)
        // await fxb.issuer_mint(owner.address, "200000");


        await fraxBondIssuer.mintBond("1000000000");
        console.log("fxb:" + await fxb.balanceOf(owner.address))
        console.log("frax:" + await frax.balanceOf(owner.address))
        console.log("exchangeRate:" + await fraxBondIssuer.exchangeRate())
        console.log("------------------------")


        // await fraxBondIssuer.redeemBond(toWei('1'));
        // console.log("exchangeRate:" + await fraxBondIssuer.exchangeRate())
        // console.log("fxb:" + await fxb.balanceOf(owner.address))
        // console.log("frax:" + await frax.balanceOf(owner.address))


    });
    // it('test recoverToken ', async () => {
    //     assert.equal(await busd.balanceOf(fraxBondIssuer.address), 0)
    //     await busd.mint(fraxBondIssuer.address, 1000)
    //     assert.equal(await busd.balanceOf(fraxBondIssuer.address), 1000)
    //     await busd.approve(fraxBondIssuer.address, toWei('1000'))
    //
    //     await fraxBondIssuer.recoverToken(busd.address, 1000)
    //     assert.equal(await busd.balanceOf(fraxBondIssuer.address), 0)
    //
    //
    // });


});
