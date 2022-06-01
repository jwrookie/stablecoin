const {toWei} = web3.utils;
const {ethers} = require("hardhat");
const {BigNumber} = require('ethers');
const {time} = require('@openzeppelin/test-helpers');
const {GetMockToken} = require("./Utils/GetMockConfig");
const {DeployThreePoolFactoryAndPancakeFactory, DeployThreePoolByThreePoolFactory} = require("./Tools/Deploy");
const {GetRusdAndTra, StableCoinPool} = require("./Utils/GetStableConfig");
const {GetUniswapByPancakeFactory, AddLiquidityByPancakeRouter, SetETHUSDOracle} = require("./Utils/GetUniswapConfig");
const GAS = {gasLimit: "9550000"};

contract('AMO Scenes', async function () {
    beforeEach(async function () {
        [owner] = await ethers.getSigners();

        [rusd, tra, operatable] = await GetRusdAndTra();

        [usdc, token1] = await GetMockToken(2, [owner], toWei("100000000"));

        stableCoinPool = await StableCoinPool(usdc, toWei("10000000000"));
        [weth, factory, threePoolFactory, threePool, router] = await DeployThreePoolFactoryAndPancakeFactory(owner, {value: toWei("100")});
        pool = await DeployThreePoolByThreePoolFactory(threePoolFactory, threePool, [usdc, rusd, token1]);

        await SetETHUSDOracle();

        await AddLiquidityByPancakeRouter(factory, [usdc, weth], router, toWei("100000"), [toWei("20000"), toWei("10")], owner);
        await AddLiquidityByPancakeRouter(factory, [rusd, weth], router, toWei("100000"), [toWei("20000"), toWei("10")], owner);
        await AddLiquidityByPancakeRouter(factory, [tra, weth], router, toWei("100000"), [toWei("20000"), toWei("10")], owner);

        usdcUniswapOracle = await GetUniswapByPancakeFactory(owner, stableCoinPool, factory.address, [usdc.address, weth.address]);
        fraxUniswapOracle = await GetUniswapByPancakeFactory(owner, stableCoinPool, factory.address, [rusd.address, weth.address]);
        fxsUniswapOracle = await GetUniswapByPancakeFactory(owner, stableCoinPool, factory.address, [tra.address, weth.address]);


        // About amo and exchange amo
        const AMOMinter = await ethers.getContractFactory('AMOMinter');
        amoMinter = await AMOMinter.deploy(
            operatable.address,
            rusd.address,
            tra.address,
            usdc.address,
            stableCoinPool.address
        );

        const ExchangeAMO = await ethers.getContractFactory('ExchangeAMO');
        exchangeAMO = await ExchangeAMO.deploy(
            operatable.address,
            amoMinter.address,
            rusd.address,
            tra.address,
            usdc.address,
            pool.address,
            pool.address, // 3pool Lp address
            1,
            0
        );

        secondeExchangeAMO = await ExchangeAMO.deploy(
            operatable.address,
            amoMinter.address,
            rusd.address,
            tra.address,
            usdc.address,
            pool.address,
            pool.address, // 3pool Lp address
            1,
            0
        );

        // Approve
        await usdc.approve(stableCoinPool.address, toWei("1"));

        // Add pool
        await rusd.addPool(amoMinter.address);
        await rusd.addPool(stableCoinPool.address);

        await tra.addPool(stableCoinPool.address);
        await tra.addPool(amoMinter.address);

        // Through registry center to add pool in pool registry
        // await registry.set_address(0, poolRegistry.address);

        // Approve for pool
        await usdc.approve(pool.address, toWei("10000"));
        await token1.approve(pool.address, toWei("10000"));
        await rusd.approve(pool.address, toWei("10000"));

        // Add liquidity
        await pool.add_liquidity([toWei("100"), toWei("100"), toWei("100")], 0, GAS);
        await amoMinter.addAMO(exchangeAMO.address, true); // Because will call the function dollarBalances and find get lpBalance in 3pool so need to add liquidity in 3pool
        await stableCoinPool.addAMOMinter(amoMinter.address); // Because amo will borrow usdc from stable coin pool
    });

    it('Modify amo by amo minter', async function () {
        expect(await amoMinter.isAmo(exchangeAMO.address)).to.be.eq(true);
        expect(await amoMinter.getAmo(0)).to.be.eq(exchangeAMO.address);
        await amoMinter.removeAMO(exchangeAMO.address, false);
        await amoMinter.addAMO(secondeExchangeAMO.address, true);
        expect(await amoMinter.isAmo(secondeExchangeAMO.address)).to.be.eq(true);
    });
});
