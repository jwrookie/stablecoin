const {toWei} = web3.utils;
const {ethers} = require("hardhat");
const {BigNumber} = require('ethers');
const {time} = require('@openzeppelin/test-helpers');
const {GetMockToken} = require("../Utils/GetMockConfig");
const {
    DeployThreePoolFactoryAndPancakeFactory,
    DeployThreePoolByThreePoolFactory
} = require("../Utils/GetThreePoolAndPancakePoolConfig");
const {GetRusdAndTra, StableCoinPool} = require("../Utils/GetStableConfig");
const {
    GetUniswapByPancakeFactory,
    AddLiquidityByPancakeRouter,
    SetETHUSDOracle
} = require("../Utils/GetUniswapConfig");
const GAS = {gasLimit: "9550000"};

contract('Rsud、StableCoinPool、AMO、ExchangeAMO', async function () {
    beforeEach(async function () {
        [owner] = await ethers.getSigners();

        [rusd, tra, operatable] = await GetRusdAndTra();

        [usdc, token1] = await GetMockToken(2, [owner], toWei("2000000"));

        stableCoinPool = await StableCoinPool(usdc.address, toWei("10000000000"));

        [weth, pancakeFactory, threePoolFactory, threePool, router] = await DeployThreePoolFactoryAndPancakeFactory(
            owner,
            {value: toWei("100")}
        );
        pool = await DeployThreePoolByThreePoolFactory(threePoolFactory, threePool, [rusd.address, usdc.address, token1.address]);

        // Create transaction pairs
        await AddLiquidityByPancakeRouter(pancakeFactory, [usdc, weth], router, toWei("30000"), [toWei("20000"), toWei("10")], owner);
        await AddLiquidityByPancakeRouter(pancakeFactory, [rusd, weth], router, toWei("30000"), [toWei("20000"), toWei("10")], owner);
        await AddLiquidityByPancakeRouter(pancakeFactory, [tra, weth], router, toWei("30000"), [toWei("20000"), toWei("10")], owner);

        await SetETHUSDOracle(rusd);
        usdcUniswapOracle = await GetUniswapByPancakeFactory(stableCoinPool, pancakeFactory.address, [usdc.address, weth.address]);
        fraxUniswapOracle = await GetUniswapByPancakeFactory(stableCoinPool, pancakeFactory.address, [rusd.address, weth.address]);
        fxsUniswapOracle = await GetUniswapByPancakeFactory(stableCoinPool, pancakeFactory.address, [tra.address, weth.address]);

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

        // Approve
        await usdc.approve(stableCoinPool.address, toWei("10000"));

        // Add pool
        await rusd.addPool(amoMinter.address);
        await rusd.addPool(stableCoinPool.address);

        await tra.addPool(stableCoinPool.address);
        await tra.addPool(amoMinter.address);

        // Through registry center to add pool in pool registry
        // await registry.set_address(0, poolRegistry.address);

        // Approve for pool
        await usdc.approve(pool.address, toWei("30000"));
        await token1.approve(pool.address, toWei("30000"));
        await rusd.approve(pool.address, toWei("30000"));

        // Add liquidity
        await pool.add_liquidity([toWei("100"), toWei("100"), toWei("100")], 0, GAS);
        await amoMinter.addAMO(exchangeAMO.address, true); // Because will call the function dollarBalances and find get lpBalance in 3pool so need to add liquidity in 3pool
        await stableCoinPool.addAMOMinter(amoMinter.address); // Because amo will borrow usdc from stable coin pool
    });

    it('when user mint rusd will trigger exchange amo and do not with draw rusd', async function () {
        // Because minting needs to obtain the price of collateral to USD, the predictor needs to be refreshed
        await expect(usdcUniswapOracle.update()).to.be.revertedWith("UniswapPairOracle: PERIOD_NOT_ELAPSED");
        await time.increase(await time.duration.hours(1));
        await usdcUniswapOracle.update();

        expect(await rusd.balanceOf(owner.address)).to.be.eq(toWei('1979900'));
        await stableCoinPool.mint1t1Stable(toWei("1"), 0);
        expect(await rusd.balanceOf(owner.address)).to.be.eq(toWei('1979900.0005'));

        await amoMinter.setMinimumCollateralRatio(0);
        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq(0);
        await amoMinter.mintStableForAMO(exchangeAMO.address, toWei("1"));
        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq(toWei('1'));

        await amoMinter.setCollatBorrowCap(toWei("10"));
        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(0);
        expect(await usdc.balanceOf(stableCoinPool.address)).to.be.eq(toWei('1'));
        await amoMinter.giveCollatToAMO(exchangeAMO.address, toWei("1"));
        expect(await usdc.balanceOf(stableCoinPool.address)).to.be.eq(0);
        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(toWei('1'));
        expect(await usdc.balanceOf(pool.address)).to.be.eq(toWei('100'));
        expect(await rusd.balanceOf(pool.address)).to.be.eq(toWei('100'));

        expect(await pool.balanceOf(exchangeAMO.address, GAS)).to.be.eq(0);
        await exchangeAMO.poolDeposit(toWei("0.5"), toWei("0.1"));
        expect(await pool.balanceOf(exchangeAMO.address, GAS)).to.be.eq("599879617905205347");
        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq(BigNumber.from(toWei('1')).sub(toWei('0.5')));
        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(BigNumber.from(toWei('1')).sub(toWei("0.1")));
        expect(await usdc.balanceOf(pool.address)).to.be.eq(BigNumber.from(toWei('100')).add(toWei('0.1')));
        expect(await rusd.balanceOf(pool.address)).to.be.eq(BigNumber.from(toWei('100')).add(toWei('0.5')));

        let poolAmountBef = await pool.balanceOf(exchangeAMO.address, GAS);
        let poolAmount = poolAmountBef.div(2)
        await exchangeAMO.poolWithdrawStable(poolAmount, true);

        let poolAmountaAft = await pool.balanceOf(exchangeAMO.address, GAS);
        expect(poolAmountaAft).to.be.eq("299939808952602674");
        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq(toWei('0.5'));

        //Confirm destruction
        await exchangeAMO.poolWithdrawStable(poolAmountaAft, false);

        poolAmountaAft = await pool.balanceOf(exchangeAMO.address, GAS);
        expect(poolAmountaAft).to.be.eq(0);
        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq("799879940839912524");


    });

    it('when user mint rusd will trigger exchange amo and with draw', async function () {
        await time.increase(await time.duration.hours(1));
        await usdcUniswapOracle.update();

        await stableCoinPool.mint1t1Stable(toWei("1"), 0);

        await amoMinter.setMinimumCollateralRatio(0);
        await amoMinter.mintStableForAMO(exchangeAMO.address, toWei("1"));

        await amoMinter.setCollatBorrowCap(toWei("10"));
        await amoMinter.giveCollatToAMO(exchangeAMO.address, toWei("1"));
        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq(toWei("1"));
        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(toWei('1'));
        expect(await pool.balanceOf(exchangeAMO.address, GAS)).to.be.eq(0);

        expect(await usdc.balanceOf(pool.address)).to.be.eq(toWei('100'));
        expect(await rusd.balanceOf(pool.address)).to.be.eq(toWei('100'));
        await exchangeAMO.poolDeposit(toWei("0.5"), toWei("0.1"));
        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq(BigNumber.from(toWei('1')).sub(toWei('0.5')));
        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(BigNumber.from(toWei('1')).sub(toWei("0.1")));
        expect(await usdc.balanceOf(pool.address)).to.be.eq(BigNumber.from(toWei('100')).add(toWei('0.1')));
        expect(await rusd.balanceOf(pool.address)).to.be.eq(BigNumber.from(toWei('100')).add(toWei('0.5')));

        let poolAmountBef = await pool.balanceOf(exchangeAMO.address, GAS);
        await exchangeAMO.poolWithdrawCollateral(poolAmountBef);

        let poolAmountaAft = await pool.balanceOf(exchangeAMO.address, GAS);
        expect(poolAmountaAft).to.be.eq(0);
        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq("1499758801972829521");

    });

    it('No borrowing, no collateral coinage, investment profit', async function () {
        await time.increase(await time.duration.hours(1));
        await usdcUniswapOracle.update();

        await amoMinter.setMinimumCollateralRatio(0);
        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq(0);
        await amoMinter.mintStableForAMO(exchangeAMO.address, toWei("1"));
        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq(toWei('1'));
        expect(await rusd.balanceOf(pool.address)).to.be.eq(toWei('100'));

        await exchangeAMO.poolDeposit(toWei("0.5"), 0);
        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq(BigNumber.from(toWei('1')).sub(toWei('0.5')));
        expect(await rusd.balanceOf(pool.address)).to.be.eq(BigNumber.from(toWei('100')).add(toWei('0.5')));

        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(0);
        let poolAmountBef = await pool.balanceOf(exchangeAMO.address, GAS);
        expect(poolAmountBef).to.be.eq("499899584754389221");
        await exchangeAMO.poolWithdrawCollateral(poolAmountBef);
        let poolAmountAft = await pool.balanceOf(exchangeAMO.address, GAS);
        expect(poolAmountAft).to.be.eq(0);
        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq("499798771300969441");

    });

});
