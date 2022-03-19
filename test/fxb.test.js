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

        await factory.createPair(usdc.address, weth.address)
        pairAddr = await factory.getPair(usdc.address, weth.address)
        // console.log("pair:" + pairAddr)
        usdc_busd = await pair.attach(pairAddr)
        assert.equal(usdc_busd.address, pairAddr)


        await usdc.approve(router.address, toWei('1000'))
        await weth.approve(router.address, toWei('1000'))
        await usdc.mint(owner.address, toWei('100'))
        //await busd.mint(owner.address, toWei('100'))
        await weth.deposit({value: toWei('100')})
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

        assert.equal(await fraxBondIssuer.FRAX(), frax.address);
        assert.equal(await fraxBondIssuer.FXB(), fxb.address);
        console.log("vBalFarx:" + await fraxBondIssuer.vBalFarx())
        console.log("vBalFxb:" + await fraxBondIssuer.vBalFxb())


        const PoolvAMM_USDC = await ethers.getContractFactory('PoolvAMM_USDC');
        poolvAMMC = await PoolvAMM_USDC.deploy(
            frax.address,
            fxb.address,
            usdc.address,
            owner.address,
            timelock.address,
            factory.address,
            uniswapOracle.address,
            toWei('100')
        );

       // console.log("poolvAMMC:"+poolvAMMC.address)

    });

    it('test addIssuer and removeIssuer  ', async () => {
        assert.equal(await fxb.bond_issuers(owner.address), false)
        await fxb.addIssuer(owner.address);
        assert.equal(await fxb.bond_issuers(owner.address), true)
        console.log("fxb:" + await fxb.balanceOf(fraxBondIssuer.address))
        await fxb.issuer_mint(fraxBondIssuer.address, 200000)
        await fxb.issuer_mint(owner.address, 100000)
        // console.log("fxb:"+await fxb.balanceOf(fraxBondIssuer.address))
        // console.log("frax:"+await frax.balanceOf(owner.address))
        //   console.log("frax fraxBondIssuer:"+await frax.balanceOf(fraxBondIssuer.address))


        await frax.approve(fraxBondIssuer.address, toWei('1000'))
        await fxb.approve(fraxBondIssuer.address, toWei('1000'))
        await frax.addPool(fraxBondIssuer.address)

        await fraxBondIssuer.redeemFXB(100000)
        // console.log("frax:" + await frax.balanceOf(owner.address))
        // console.log("fxb:" + await fxb.balanceOf(fraxBondIssuer.address))
        //
        // console.log("frax:" + await frax.balanceOf(owner.address))
        // console.log("fxb:" + await fxb.balanceOf(fraxBondIssuer.address))


        await fxb.issuer_burn_from(fraxBondIssuer.address, 200000);
        // console.log("frax:" + await frax.balanceOf(owner.address))
        // console.log("fxb:" + await frax.balanceOf(fraxBondIssuer.address))


        await fxb.removeIssuer(owner.address)
        assert.equal(await fxb.bond_issuers(owner.address), false)

    });
    it('test buyUnissuedFXB ', async () => {
        assert.equal(await fxb.bond_issuers(owner.address), false)
        await fxb.addIssuer(owner.address);
        await fxb.addIssuer(fraxBondIssuer.address);
        assert.equal(await fxb.bond_issuers(owner.address), true)
        // console.log("fxb:"+await fxb.balanceOf(fraxBondIssuer.address))
        await fxb.issuer_mint(fraxBondIssuer.address, 200000)
        await fxb.issuer_mint(owner.address, 100000)


        await frax.approve(fraxBondIssuer.address, toWei('1000'))
        await fxb.approve(fraxBondIssuer.address, toWei('1000'))
        await frax.addPool(fraxBondIssuer.address)

        await uniswapOracle.setPeriod(1);

        await uniswapOracle.update();
        console.log("oraclePrice:" + await uniswapOracle.consult(weth.address, 10 ** 6))
        console.log("price0Average:" + await uniswapOracle.price0Average())
        console.log("price1Average:" + await uniswapOracle.price1Average())

        console.log("floor_price:" + await fraxBondIssuer.floor_price())


        console.log("fraxPrice:" + await frax.fraxPrice())
        console.log("fxb:"+await fxb.balanceOf(owner.address))

        await fraxBondIssuer.buyUnissuedFXB(1000, 0)
        console.log("fxb:"+await fxb.balanceOf(owner.address))
       // console.log("amm_spot_price:"+await fraxBondIssuer.amm_spot_price())

       // await fraxBondIssuer.sellFXBintoAMM(1000,0)

    });
    // it("test buyFXBfromAMM",async () => {
    //     assert.equal(await fxb.bond_issuers(owner.address), false)
    //     await fxb.addIssuer(owner.address);
    //     await fxb.addIssuer(fraxBondIssuer.address);
    //     assert.equal(await fxb.bond_issuers(owner.address), true)
    //     // console.log("fxb:"+await fxb.balanceOf(fraxBondIssuer.address))
    //     await fxb.issuer_mint(fraxBondIssuer.address, 200000)
    //     await fxb.issuer_mint(owner.address, 100000)
    //
    //
    //     await frax.approve(fraxBondIssuer.address, toWei('1000'))
    //     await fxb.approve(fraxBondIssuer.address, toWei('1000'))
    //     await frax.addPool(fraxBondIssuer.address)
    //
    //     await uniswapOracle.setPeriod(1);
    //
    //
    //     await uniswapOracle.update();
    //     console.log("oraclePrice:" + await uniswapOracle.consult(weth.address, 10 ** 6))
    //     console.log("price0Average:" + await uniswapOracle.price0Average())
    //     console.log("price1Average:" + await uniswapOracle.price1Average())
    //
    //     console.log("floor_price:" + await fraxBondIssuer.floor_price())
    //     // await fraxBondIssuer.buyFXBfromAMM(1000,10)
    //
    //     // let consults = await uniswapOracle.
    //
    //
    //     console.log("fraxPrice:" + await frax.fraxPrice())
    //     await fraxBondIssuer.buyFXBfromAMM(1000, 0)
    //
    // });

});
