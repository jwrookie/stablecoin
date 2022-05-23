const {ethers} = require("hardhat");
const {BigNumber} = require('ethers');
const {toWei, fromWei, toBN} = web3.utils;
const {GetMockToken} = require("./Utils/GetMockConfig");
const {GetConfigAboutCRV, CrvFactoryDeploy} = require("./Tools/Deploy");
const {GetUniswap, RouterApprove, SetETHUSDOracle} = require("./Utils/GetUniswapConfig");
const {GetRusdAndTra, StableCoinPool} = require("./Utils/GetStableConfig");
const GAS = {gasLimit: "9550000"};

contract('Rsud、StableCoinPool、AMO、ExchangeAMO', async function (){
    beforeEach(async function (){
        [owner] = await ethers.getSigners();

        [rusd, tra, operatable] = await GetRusdAndTra();

        [usdc, token1] = await GetMockToken(2, [owner], toWei("1000"));

        stableCoinPool = await StableCoinPool(usdc, toWei("10000000000"));

        [weth, factory, registry, poolRegistry] = await GetConfigAboutCRV(owner);
        pool = await CrvFactoryDeploy([rusd, usdc, token1], {});

        // Create transaction pairs
        await factory.createPair(usdc.address, weth.address);
        await factory.createPair(rusd.address, weth.address);
        await factory.createPair(tra.address, weth.address);

        await RouterApprove(usdc, toWei("1000"), [], owner);
        await RouterApprove(rusd, toWei("1000"),[toWei("0.5")], owner);
        await RouterApprove(tra, toWei("1000"),[toWei("0.1")], owner);

        await SetETHUSDOracle();
        usdcUniswapOracle = await GetUniswap(owner, stableCoinPool, factory, usdc, weth);
        rusdUniswapOracle = await GetUniswap(owner, stableCoinPool, factory, rusd, weth);
        traUniswapOracle = await GetUniswap(owner, stableCoinPool, factory, tra, weth);

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
            usdc.address,
            pool.address,
            pool.address // 3pool Lp address
        );

        // Approve
        await usdc.approve(stableCoinPool.address, toWei("1"));

        // Add pool
        await rusd.addPool(amoMinter.address);
        // await rusd.addPool(pool.address);

        await tra.addPool(stableCoinPool.address);
        await tra.addPool(amoMinter.address);

        // Through registry center to add pool in pool registry
        await registry.set_address(0, poolRegistry.address);

        // Approve for pool
        await usdc.approve(pool.address, toWei("10000"));
        await token1.approve(pool.address, toWei("10000"));
        await rusd.approve(pool.address, toWei("10000"));
        await rusd.approve(stableCoinPool.address, toWei("10000")); // Important
        await tra.approve(pool.address, toWei("10000"));
        await tra.approve(stableCoinPool.address, toWei("10000")); // Important

        // Add liquidity
        await pool.add_liquidity([toWei("100"), toWei("100"), toWei("100")], 0, GAS);
        await amoMinter.addAMO(exchangeAMO.address, true); // Because will call the function dollarBalances and find get lpBalance in 3pool so need to add liquidity in 3pool
        await stableCoinPool.addAMOMinter(amoMinter.address); // Because amo will borrow usdc from stable coin pool
    });

    it('when user mint rusd will trigger exchange amo', async function () {
        // Refresh tra uniswaporacle and usdc uniswap to get tra price, because tra price is bound usdc price
        await usdcUniswapOracle.setPeriod(1);
        await usdcUniswapOracle.update();
        await traUniswapOracle.setPeriod(1);
        await traUniswapOracle.update();
        await rusdUniswapOracle.setPeriod(1);
        await rusdUniswapOracle.update();

        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq(0);
        await amoMinter.setMinimumCollateralRatio(0);
        await amoMinter.mintStableForAMO(exchangeAMO.address, toWei("1"));
        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq(toWei("1"));

        // Operator call function to borrow usdc
        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(0);
        await amoMinter.setCollatBorrowCap(toWei("10"));
        await usdc.approve(amoMinter.address, toWei("1"));
        await amoMinter.setMinimumCollateralRatio(950000);
        await amoMinter.giveCollatToAMO(exchangeAMO.address, toWei("1"));
        // expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(toWei("1"));
        //
        // beforeAddLiquidityRusd = await rusd.balanceOf(pool.address); // towei("100")
        // beforeAddLiquidityUsdc = await usdc.balanceOf(pool.address);
        // await usdc.approve(exchangeAMO.address, toWei("10000"));
        // lpReceived = await exchangeAMO.metapoolDeposit(toWei("0.5"), toWei("0.1"));
        // console.log(await exchangeAMO.min3PoolOut());
        // console.log(lpReceived);
    });
});
