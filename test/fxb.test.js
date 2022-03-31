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
        fraxBondIssuer = await FraxBondIssuer.connect(rewardAddr).deploy(frax.address, fxb.address);
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
    it('test mintBond and redeemBond', async () => {
        await fxb.addIssuer(fraxBondIssuer.address);
        await frax.approve(fraxBondIssuer.address, toWei('10000'));
        await fxb.approve(fraxBondIssuer.address, toWei('10000'));
        await frax.connect(rewardAddr).approve(fraxBondIssuer.address, toWei('10000'));
        await fxb.connect(rewardAddr).approve(fraxBondIssuer.address, toWei('10000'));
        await frax.addPool(fraxBondIssuer.address);

        assert.equal(await fxb.balanceOf(owner.address), 0);
        assert.equal(await frax.balanceOf(fraxBondIssuer.address), 0);
        assert.equal(await frax.balanceOf(owner.address), "2000000000000000000000000");
        assert.equal(await fraxBondIssuer.vBalStable(), 0);
        console.log("fee:"+await fraxBondIssuer.fee())

        await fraxBondIssuer.connect(owner).mintBond("100000");
        console.log("exchangeRate:" + await fraxBondIssuer.exchangeRate());
        console.log("fee:"+await fraxBondIssuer.fee())
       // assert.equal(await fxb.balanceOf(owner.address), "65675");
        assert.equal(await frax.balanceOf(fraxBondIssuer.address), "10");
        assert.equal(await frax.balanceOf(owner.address), "1999999999999999999900000");
        assert.equal(await fraxBondIssuer.vBalStable(), "100000");

        await fraxBondIssuer.connect(rewardAddr).claimFee();
        assert.equal(await frax.balanceOf(rewardAddr.address), "10");

        await fraxBondIssuer.connect(owner).redeemBond("65675");

        console.log("exchangeRate:" + await fraxBondIssuer.exchangeRate());
           console.log("fee:"+await fraxBondIssuer.fee())
       // assert.equal(await fxb.balanceOf(owner.address), 0);
        assert.equal(await frax.balanceOf(fraxBondIssuer.address), "9");
        assert.equal(await frax.balanceOf(owner.address), "1999999999999999999999990");
        assert.equal(await fraxBondIssuer.vBalStable(), "1");

        await fraxBondIssuer.connect(rewardAddr).claimFee();
        assert.equal(await frax.balanceOf(rewardAddr.address), "19");


    });
    it('1/10 interestRate', async () => {
        await fxb.addIssuer(fraxBondIssuer.address);
        await fxb.addIssuer(owner.address);
        await fraxBondIssuer.setMaxBondOutstanding(toWei('1'));

        await frax.connect(owner).approve(fraxBondIssuer.address, toWei('10000'));
        await fxb.connect(owner).approve(fraxBondIssuer.address, toWei('10000'));
        await frax.connect(rewardAddr).approve(fraxBondIssuer.address, toWei('10000'));
        await fxb.connect(rewardAddr).approve(fraxBondIssuer.address, toWei('10000'));
        await frax.addPool(fraxBondIssuer.address);

        await fxb.issuer_mint(owner.address, toWei('10'));
        assert.equal(await fxb.balanceOf(owner.address), "10000000000000000000");
        assert.equal(await frax.balanceOf(owner.address), "2000000000000000000000000");
        assert.equal(await frax.balanceOf(fraxBondIssuer.address), "0");
        assert.equal(await fraxBondIssuer.vBalStable(), "0");

        await fraxBondIssuer.connect(owner).mintBond("100000");
        console.log("exchangeRate:" + await fraxBondIssuer.exchangeRate());
        assert.equal(await fxb.balanceOf(owner.address), "10000000000000095033");
        assert.equal(await frax.balanceOf(owner.address), "1999999999999999999900000");
        assert.equal(await frax.balanceOf(fraxBondIssuer.address), "10");
        assert.equal(await fraxBondIssuer.vBalStable(), "100000");


        await fraxBondIssuer.connect(rewardAddr).claimFee();
        assert.equal(await frax.balanceOf(rewardAddr.address), "10");

        await fraxBondIssuer.connect(owner).redeemBond("95034");

        assert.equal(await fxb.balanceOf(owner.address), "9999999999999999999");
        assert.equal(await frax.balanceOf(owner.address), "1999999999999999999999990");
        assert.equal(await frax.balanceOf(fraxBondIssuer.address), "10");
        assert.equal(await fraxBondIssuer.vBalStable(), 0);

        await fraxBondIssuer.connect(rewardAddr).claimFee();
        assert.equal(await frax.balanceOf(rewardAddr.address), "20");


    });
    it('test recoverToken ', async () => {
        assert.equal(await busd.balanceOf(fraxBondIssuer.address), 0)
        await busd.mint(fraxBondIssuer.address, 1000)
        assert.equal(await busd.balanceOf(fraxBondIssuer.address), 1000)
        await busd.approve(fraxBondIssuer.address, toWei('1000'))

        await fraxBondIssuer.recoverToken(busd.address, 1000)
        assert.equal(await busd.balanceOf(fraxBondIssuer.address), 0)


    });


});
