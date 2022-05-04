const {expectRevert, time} = require('@openzeppelin/test-helpers');
const {ethers, waffle} = require("hardhat");
const {toWei} = web3.utils;
const Factory = require('../test/mock/PancakeFactory.json');
const Pair = require('../test/mock/PancakePair.json');
const Router = require('../test/mock/PancakeRouter.json');
const WETH = require('../test/mock/WETH9.json');
const {BigNumber} = require('ethers');
const {expect} = require("chai");
const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
}

contract('FraxBond', () => {
    beforeEach(async () => {
        [owner, dev, addr1, rewardAddr] = await ethers.getSigners();
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

        const Operatable = await ethers.getContractFactory('Operatable');
        operatable = await Operatable.deploy();

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(operatable.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(operatable.address, "frax", "frax");

        await fxs.setFraxAddress(frax.address);
        await frax.setFXSAddress(fxs.address);

        expect(await fxs.oracle()).to.be.eq(oracle.address);
        expect(await frax.fxsAddress()).to.be.eq(fxs.address);

        const PoolLibrary = await ethers.getContractFactory('PoolLibrary')
        poolLibrary = await PoolLibrary.deploy();

        const Pool_USDC = await ethers.getContractFactory('Pool_USDC', {
            libraries: {
                PoolLibrary: poolLibrary.address,
            },
        });
        pool = await Pool_USDC.deploy(operatable.address, frax.address, fxs.address, usdc.address, toWei('100'));
        expect(await pool.USDC_address()).to.be.eq(usdc.address);


        const MockChainLink = await ethers.getContractFactory("MockChainLink");
        chainLink = await MockChainLink.deploy();

        const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
        chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);
        await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);

        await chainLink.setAnswer(toWei('100'));

        expect(await fxs.balanceOf(owner.address)).to.be.eq(toWei('100000000'));
        expect(await frax.balanceOf(owner.address)).to.be.eq(toWei('2000000'));
        await usdc.mint(owner.address, toWei('1'));

        await frax.approve(pool.address, toWei('1000'));
        await fxs.approve(pool.address, toWei('1000'));
        await usdc.approve(pool.address, toWei('1000'));


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

        await factory.createPair(frax.address, weth.address);
        await factory.createPair(fxs.address, weth.address);
        // console.log("pair:" + pairAddr);
        usdc_busd = await pair.attach(pairAddr);
        expect(usdc_busd.address).to.be.eq(pairAddr);

        await usdc.approve(router.address, toWei('1000'));
        await weth.approve(router.address, toWei('1000'));
        await usdc.mint(owner.address, toWei('1000000000000'));
        //await busd.mint(owner.address, toWei('100'));
        await weth.deposit({value: toWei('100')});
        expect(await weth.balanceOf(owner.address)).to.be.eq(toWei('100'));

        await router.addLiquidity(
            usdc.address,
            weth.address,
            toWei('1'),
            toWei('1'),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 1000)
        );

        await frax.approve(router.address, toWei('1000'));

        await router.addLiquidity(
            frax.address,
            weth.address,
            toWei('1'),
            toWei('1'),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 1000)
        );

        await fxs.approve(router.address, toWei('1000'));
        await router.addLiquidity(
            fxs.address,
            weth.address,
            toWei('1'),
            toWei('1'),
            0,
            0,
            owner.address,
            Math.round(new Date() / 1000 + 1000)
        );

        const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
        usdc_uniswapOracle = await UniswapPairOracle.deploy(factory.address, usdc.address, weth.address, owner.address, timelock.address);
        await pool.setCollatETHOracle(usdc_uniswapOracle.address, weth.address);

        frax_uniswapOracle = await UniswapPairOracle.deploy(factory.address, frax.address, weth.address, owner.address, timelock.address);
        await frax.setFRAXEthOracle(frax_uniswapOracle.address, weth.address);
        expect(await frax.fraxEthOracleAddress()).to.be.eq(frax_uniswapOracle.address);

        fxs_uniswapOracle = await UniswapPairOracle.deploy(factory.address, fxs.address, weth.address, owner.address, timelock.address);
        await frax.setFXSEthOracle(fxs_uniswapOracle.address, weth.address);
        expect(await frax.fxsEthOracleAddress()).to.be.eq(fxs_uniswapOracle.address);


        const FraxBond = await ethers.getContractFactory("Bond");
        fxb = await FraxBond.deploy(operatable.address, "fxb", "fxb");

        const FraxBondIssuer = await ethers.getContractFactory('BondIssuer');
        fraxBondIssuer = await FraxBondIssuer.deploy(operatable.address, frax.address, fxb.address);
        // console.log("fraxBondIssuer:"+fraxBondIssuer.address)

        expect(await fraxBondIssuer.stableCoin()).to.be.eq(frax.address);
        expect(await fraxBondIssuer.bond()).to.be.eq(fxb.address);
        await frax.addPool(pool.address);
        await frax.addPool(fraxBondIssuer.address);

    });

    // it('test addIssuer and removeIssuer  ', async () => {
    //     expect(await fxb.bond_issuers(owner.address)).to.be.eq(false);
    //     await fxb.addIssuer(owner.address);
    //     expect(await fxb.bond_issuers(owner.address)).to.be.eq(true);
    //     expect(await fxb.balanceOf(fraxBondIssuer.address), 0);
    //
    //     await fxb.issuer_mint(fraxBondIssuer.address, "200000");
    //     await fxb.issuer_mint(owner.address, "100000");
    //     expect(await fxb.balanceOf(fraxBondIssuer.address)).to.be.eq("200000");
    //     expect(await fxb.balanceOf(owner.address)).to.be.eq("100000");
    //
    //     await fxb.issuer_burn_from(fraxBondIssuer.address, "100000");
    //     expect(await fxb.balanceOf(fraxBondIssuer.address), "100000");
    //
    //     await fxb.removeIssuer(owner.address);
    //     expect(await fxb.bond_issuers(owner.address)).to.be.eq(false);
    //
    // });
    // it('test mintBond and redeemBond', async () => {
    //     await fxb.addIssuer(fraxBondIssuer.address);
    //     await frax.approve(fraxBondIssuer.address, toWei('10000'));
    //     await fxb.approve(fraxBondIssuer.address, toWei('10000'));
    //     await frax.connect(rewardAddr).approve(fraxBondIssuer.address, toWei('10000'));
    //     await fxb.connect(rewardAddr).approve(fraxBondIssuer.address, toWei('10000'));
    //
    //     expect(await fxb.balanceOf(owner.address)).to.be.eq(0);
    //     expect(await frax.balanceOf(fraxBondIssuer.address)).to.be.eq(0);
    //     expect(await frax.balanceOf(owner.address)).to.be.eq("1999999000000000000000000");
    //     expect(await fraxBondIssuer.vBalStable(), 0);
    //     console.log("fee:" + await fraxBondIssuer.fee())
    //
    //     await fraxBondIssuer.connect(owner).mintBond("100000");
    //     console.log("fee:" + await fraxBondIssuer.fee())
    //     console.log("exchangeRate:" + await fraxBondIssuer.exchangeRate());
    //     // expect(await fxb.balanceOf(owner.address), "65675");
    //     expect(await frax.balanceOf(fraxBondIssuer.address)).to.be.eq("10");
    //
    //     expect(await frax.balanceOf(owner.address)).to.be.eq("1999998999999999999900000");
    //     expect(await fraxBondIssuer.vBalStable()).to.be.eq("100000");
    //
    //     let rewardBef = await frax.balanceOf(owner.address);
    //     await fraxBondIssuer.claimFee();
    //
    //     let rewardAft = await frax.balanceOf(owner.address);
    //
    //     let diff = rewardAft - rewardBef
    //     console.log("rewardBef:" + rewardBef)
    //     console.log("rewardAft:" + rewardAft)
    //     console.log("diff:" + diff)
    //
    //     // expect(diff).to.be.eq("10");
    //
    //     await fraxBondIssuer.redeemBond("65600");
    //
    //     console.log("exchangeRate:" + await fraxBondIssuer.exchangeRate());
    //     //
    //     // expect(await frax.balanceOf(owner.address)).to.be.eq("1999998999999999999999912");
    //     // expect(await fxb.balanceOf(owner.address)).to.be.eq("51");
    //     // expect(await frax.balanceOf(fraxBondIssuer.address)).to.be.eq("9");
    //     //
    //     // expect(await fraxBondIssuer.vBalStable()).to.be.eq("79");
    //     console.log("owner:" + await frax.balanceOf(owner.address))
    //     let rewardAft1 = await frax.balanceOf(owner.address);
    //
    //     //
    //     await fraxBondIssuer.claimFee();
    //     console.log("owner:" + await frax.balanceOf(owner.address))
    //     let rewardAft2 = await frax.balanceOf(owner.address);
    //     let diff1 = rewardAft2 - rewardAft1
    //     console.log("diff1:" + diff1)
    //     console.log("fee:" + await fraxBondIssuer.fee())
    //     // expect(await frax.balanceOf(rewardAddr.address)).to.be.eq("19");
    //
    //
    // });
    it('1/10 interestRate', async () => {
        await fxb.addIssuer(fraxBondIssuer.address);
        await fxb.addIssuer(owner.address);
        await fraxBondIssuer.setMaxBondOutstanding(toWei('1'));

        await frax.approve(fraxBondIssuer.address, toWei('10000'));
        await fxb.approve(fraxBondIssuer.address, toWei('10000'));

        await fxb.issuer_mint(owner.address, toWei('10'));
        expect(await fxb.balanceOf(owner.address)).to.be.eq(toWei('10'));
        expect(await frax.balanceOf(owner.address)).to.be.eq(toWei('1999999'));
        expect(await frax.balanceOf(fraxBondIssuer.address)).to.be.eq("0");
        expect(await fraxBondIssuer.vBalStable()).to.be.eq("0");

        let fxbBef = await fxb.balanceOf(owner.address);

        await fraxBondIssuer.connect(owner).mintBond("100000");
        let rate = await fraxBondIssuer.exchangeRate();
        let fxbOut = BigNumber.from("100000").mul(toWei('1')).div(rate)

        let fxbAft = await fxb.balanceOf(owner.address)


        expect(fxbAft).to.be.eq(fxbBef.add(fxbOut));

        let amountBef = await frax.balanceOf(owner.address)
        expect(await frax.balanceOf(fraxBondIssuer.address)).to.be.eq("10");
        expect(await fraxBondIssuer.vBalStable()).to.be.eq("100000");

        await fraxBondIssuer.claimFee();
        let amountAft = await frax.balanceOf(owner.address);

        let diff = BigNumber.from(amountAft).sub(amountBef);
        expect(diff).to.be.eq("10")

        let fraxBef = await frax.balanceOf(owner.address)
        console.log("fxb:" + await fxb.balanceOf(owner.address))

        await fraxBondIssuer.redeemBond("95000");

        rate = await fraxBondIssuer.exchangeRate();
        let fraxOut = BigNumber.from("95000").mul(rate).div(toWei('1'))
        console.log("fxb:" + await fxb.balanceOf(owner.address))

        await fraxBondIssuer.claimFee();

        let fraxAft = await frax.balanceOf(owner.address)

        expect(fraxAft).to.be.eq(fraxBef.add(fraxOut));

        console.log("fxb:" + await fxb.balanceOf(owner.address))

        // expect(await fxb.balanceOf(owner.address)).to.be.eq( "10000000000000000028");
        //  expect(await frax.balanceOf(owner.address)).to.be.eq( "1999998999999999999999961");
        //  expect(await frax.balanceOf(fraxBondIssuer.address)).to.be.eq( "9");
        //  expect(await fraxBondIssuer.vBalStable()).to.be.eq( "30");


    });
    // it('test recoverToken ', async () => {
    //     expect(await busd.balanceOf(fraxBondIssuer.address)).to.be.eq( 0);
    //     await busd.mint(fraxBondIssuer.address, "1000");
    //     expect(await busd.balanceOf(fraxBondIssuer.address)).to.be.eq( "1000");
    //     await busd.approve(fraxBondIssuer.address, toWei('1000'));
    //
    //     await fraxBondIssuer.recoverToken(busd.address, "1000");
    //     expect(await busd.balanceOf(fraxBondIssuer.address)).to.be.eq( 0);
    //
    //
    // });
    // it("test globalCollateralValue", async () => {
    //     expect(await frax.fraxPoolAddressCount()).to.be.eq(2);
    //     await usdc_uniswapOracle.setPeriod(1);
    //     await usdc_uniswapOracle.update();
    //     await frax_uniswapOracle.setPeriod(1);
    //     await frax_uniswapOracle.update();
    //     await fxs_uniswapOracle.setPeriod(1);
    //     await fxs_uniswapOracle.update();
    //
    //     expect(await frax.globalCollateralValue()).to.be.eq(toWei('1'));
    // });


});
