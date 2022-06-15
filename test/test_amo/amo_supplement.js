const {toWei, fromWei, toBN} = web3.utils;
const {ethers} = require("hardhat");
const {BigNumber} = require('ethers');
const {expect} = require("chai");
const {time} = require('@openzeppelin/test-helpers');
const {GetMockToken} = require("../Utils/GetMockConfig");
const {GetRusdAndTra, StableCoinPool} = require("../Utils/GetStableConfig");
const {
    DeployThreePoolFactoryAndPancakeFactory,
    DeployThreePoolByThreePoolFactory
} = require("../Utils/GetThreePoolAndPancakePoolConfig");
const {
    GetUniswapByPancakeFactory,
    AddLiquidityByPancakeRouter,
    SetETHUSDOracle
} = require("../Utils/GetUniswapConfig");
const GAS = {gasLimit: "9550000"};

describe('AMO Scenes', function () {
    beforeEach(async function () {
        [owner] = await ethers.getSigners();

        [rusd, tra, operatable] = await GetRusdAndTra();

        [usdc, token1] = await GetMockToken(2, [owner], toWei("100000000"));

        stableCoinPool = await StableCoinPool(usdc.address, toWei("10000000000"));

        [weth, pancakeFactory, threePoolFactory, threePool, pancakeRouter] = await DeployThreePoolFactoryAndPancakeFactory(
            owner,
            {value: toWei("100")}
        );
        pool = await DeployThreePoolByThreePoolFactory(threePoolFactory, threePool, [rusd.address, usdc.address, token1.address]);

        // Create transaction pairs
        await AddLiquidityByPancakeRouter(pancakeFactory, [usdc, weth], pancakeRouter, toWei("30000"), [toWei("20000"), toWei("10")], owner);
        await AddLiquidityByPancakeRouter(pancakeFactory, [rusd, weth], pancakeRouter, toWei("30000"), [toWei("20000"), toWei("10")], owner);
        await AddLiquidityByPancakeRouter(pancakeFactory, [tra, weth], pancakeRouter, toWei("30000"), [toWei("20000"), toWei("10")], owner);

        await SetETHUSDOracle(rusd, toWei("2000"));
        usdcUniswapOracle = await GetUniswapByPancakeFactory(stableCoinPool, pancakeFactory.address, [usdc.address, weth.address]);
        rusdUniswapOracle = await GetUniswapByPancakeFactory(stableCoinPool, pancakeFactory.address, [rusd.address, weth.address]);
        traUniswapOracle = await GetUniswapByPancakeFactory(stableCoinPool, pancakeFactory.address, [tra.address, weth.address]);

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

        // Add pool
        await rusd.addPool(amoMinter.address);
        await rusd.addPool(stableCoinPool.address);

        await tra.addPool(stableCoinPool.address);
        await tra.addPool(amoMinter.address);

        // Approve for pool
        await usdc.approve(pool.address, toWei("1000000000"));
        await token1.approve(pool.address, toWei("1000000000"));
        await rusd.approve(pool.address, toWei("1000000000"));

        // Add liquidity
        await pool.add_liquidity([toWei("10000"), toWei("10000"), toWei("10000")], 0, GAS);
        await amoMinter.addAMO(exchangeAMO.address, true); // Because will call the function dollarBalances and find get lpBalance in 3pool so need to add liquidity in 3pool
        await stableCoinPool.addAMOMinter(amoMinter.address); // Because amo will borrow usdc from stable coin pool
    });

    it('Call the function remove amo', async function () {
        expect(await amoMinter.isAmo(exchangeAMO.address)).to.be.eq(true);
        expect(await amoMinter.getAmo(0)).to.be.eq(exchangeAMO.address);
        await amoMinter.removeAMO(exchangeAMO.address, false);
        expect(await amoMinter.isAmo(exchangeAMO.address)).to.be.eq(false);
    });

    it('Change stable price by swap and call the function stableTrackedGlobal', async function () {
        let cr = await rusd.globalCollateralRatio();
        expect(cr).to.be.eq(1e6);

        // Swap by pancake route
        let _deadline = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        for (let i = 0; i < 10; i++) {
            await pancakeRouter.swapExactTokensForTokens(
                toWei("1"),
                0,
                [weth.address, rusd.address],
                owner.address,
                _deadline
            );
            // Change stable coin price and refresh uniswap
            await time.increase(time.duration.hours(1));
            await rusdUniswapOracle.update();
            await rusd.refreshCollateralRatio(); // Because new cr >= min cr
        }
        await traUniswapOracle.update();
        await usdcUniswapOracle.update();

        await usdc.approve(stableCoinPool.address, toWei("100000000"));
        await tra.approve(stableCoinPool.address, toWei("100000000"));

        cr = await rusd.globalCollateralRatio();

        let _stockAmount = BigNumber.from(toWei("80000000")).mul(1e6 - cr);
        await stableCoinPool.mintFractionalStable(toWei("80000000"), _stockAmount, 0);

        cr = await rusd.globalCollateralRatio();
        expect(cr).to.be.gt(await amoMinter.minCR());

        await amoMinter.mintStableForAMO(exchangeAMO.address, toWei("200"));

        expect(await amoMinter.stableTrackedAMO(exchangeAMO.address)).to.be.eq(0);
    });

    it('Borrow by amo and give back', async function () {
        let cr = await rusd.globalCollateralRatio();
        expect(cr).to.be.eq(1e6);

        // Swap by pancake route
        let _deadline = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        for (let i = 0; i < 10; i++) {
            await pancakeRouter.swapExactTokensForTokens(
                toWei("1"),
                0,
                [weth.address, rusd.address],
                owner.address,
                _deadline
            );
            // Change stable coin price and refresh uniswap
            await time.increase(time.duration.hours(1));
            await rusdUniswapOracle.update();
            await rusd.refreshCollateralRatio(); // Because new cr >= min cr
        }
        await traUniswapOracle.update();
        await usdcUniswapOracle.update();

        await usdc.approve(stableCoinPool.address, toWei("100000000"));
        await tra.approve(stableCoinPool.address, toWei("100000000"));

        cr = await rusd.globalCollateralRatio();

        let _stockAmount = BigNumber.from(toWei("80000000")).mul(1e6 - cr);
        await stableCoinPool.mintFractionalStable(toWei("80000000"), _stockAmount, 0);

        cr = await rusd.globalCollateralRatio();
        expect(cr).to.be.gt(await amoMinter.minCR());

        await amoMinter.mintStableForAMO(exchangeAMO.address, toWei("200"));

        await amoMinter.setCollatBorrowCap(toWei("300"));
        expect(await tra.balanceOf(stableCoinPool.address)).to.be.eq(0);
        await amoMinter.poolRedeem(toWei("200"));
        expect(await tra.balanceOf(stableCoinPool.address)).to.be.eq(toWei("5"));
        expect(await stableCoinPool.redeemStockBalances(amoMinter.address)).to.be.eq(toWei("5"));
        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(0);
        await operatable.addContract(amoMinter.address); // You need to manually add a whitelist
        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(0);
        await amoMinter.poolCollectAndGive(exchangeAMO.address);
        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(toWei("195"));
    });

    it('No borrow, mint rusd and redeem call the function give back', async function () {
        let cr = await rusd.globalCollateralRatio();
        expect(cr).to.be.eq(1e6);

        // Swap by pancake route
        let _deadline = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        for (let i = 0; i < 10; i++) {
            await pancakeRouter.swapExactTokensForTokens(
                toWei("1"),
                0,
                [weth.address, rusd.address],
                owner.address,
                _deadline
            );
            // Change stable coin price and refresh uniswap
            await time.increase(time.duration.hours(1));
            await rusdUniswapOracle.update();
            await rusd.refreshCollateralRatio(); // Because new cr >= min cr
        }
        await traUniswapOracle.update();
        await usdcUniswapOracle.update();

        await usdc.approve(stableCoinPool.address, toWei("100000000"));
        await tra.approve(stableCoinPool.address, toWei("100000000"));

        cr = await rusd.globalCollateralRatio();

        let _stockAmount = BigNumber.from(toWei("80000000")).mul(1e6 - cr);
        await stableCoinPool.mintFractionalStable(toWei("80000000"), _stockAmount, 0);

        cr = await rusd.globalCollateralRatio();
        expect(cr).to.be.gt(await amoMinter.minCR());

        await amoMinter.mintStableForAMO(exchangeAMO.address, toWei("200"));

        await amoMinter.setCollatBorrowCap(toWei("300"));
        await amoMinter.poolRedeem(toWei("200"));
        await operatable.addContract(amoMinter.address); // You need to manually add a whitelist
        await amoMinter.poolCollectAndGive(exchangeAMO.address);
        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(toWei("195"));

        await exchangeAMO.giveCollatBack(await usdc.balanceOf(exchangeAMO.address));
    });

    it('Modify liqSlippage3crv and deposite', async function () {
        let _depositCollateAmount;
        let _stableDepositAmount = toWei("200");
        let calThreePoolOutCollateAmount;
        let calThreePoolOutStableAmount;

        let cr = await rusd.globalCollateralRatio();
        expect(cr).to.be.eq(1e6);

        // Swap by pancake route
        let _deadline = Number((new Date().getTime() / 1000 + 260000000).toFixed(0));
        for (let i = 0; i < 10; i++) {
            await pancakeRouter.swapExactTokensForTokens(
                toWei("1"),
                0,
                [weth.address, rusd.address],
                owner.address,
                _deadline
            );
            // Change stable coin price and refresh uniswap
            await time.increase(time.duration.hours(1));
            await rusdUniswapOracle.update();
            await rusd.refreshCollateralRatio(); // Because new cr >= min cr
        }
        await traUniswapOracle.update();
        await usdcUniswapOracle.update();

        await usdc.approve(stableCoinPool.address, toWei("100000000"));
        await tra.approve(stableCoinPool.address, toWei("100000000"));

        cr = await rusd.globalCollateralRatio();

        let _stockAmount = BigNumber.from(toWei("80000000")).mul(1e6 - cr);
        await stableCoinPool.mintFractionalStable(toWei("80000000"), _stockAmount, 0);

        cr = await rusd.globalCollateralRatio();
        expect(cr).to.be.gt(await amoMinter.minCR());

        // Give collect to amo
        await amoMinter.setCollatBorrowCap(toWei("10"));
        await amoMinter.giveCollatToAMO(exchangeAMO.address, toWei("1"));
        _depositCollateAmount = toWei("1");
        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(toWei("1"));

        await amoMinter.mintStableForAMO(exchangeAMO.address, _stableDepositAmount);
        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq(toWei("200"));
        expect(await rusd.decimals()).to.be.eq(18);

        await exchangeAMO.setSlippages(900000);
        expect(await exchangeAMO.liqSlippage3crv()).to.be.eq(900000);

        calThreePoolOutCollateAmount = BigNumber.from(_depositCollateAmount).mul(1).mul(await exchangeAMO.liqSlippage3crv()).div(await exchangeAMO.PRICE_PRECISION());
        expect(calThreePoolOutCollateAmount).to.be.eq(BigNumber.from(toWei("1")).mul(9).div(10));

        expect(await pool.balanceOf(exchangeAMO.address, GAS)).to.be.eq(0);
        calThreePoolOutStableAmount = BigNumber.from(_stableDepositAmount).add(0).mul(await exchangeAMO.liqSlippage3crv()).div(await exchangeAMO.PRICE_PRECISION());
        expect(calThreePoolOutStableAmount).to.be.eq(BigNumber.from(toWei("200")).mul(9).div(10));

        await exchangeAMO.poolDeposit(_stableDepositAmount, _depositCollateAmount)
        expect(await pool.balanceOf(exchangeAMO.address, GAS)).to.be.eq(BigNumber.from("200959142973234434453"));
    });

    it('Call the function setStableMintCap', async function () {
        await amoMinter.setStableMintCap(toWei("1"));
        expect(await amoMinter.stableCoinMintCap()).to.be.eq(toWei("1"));
    });

    it('Call the function setStockMintCap', async function () {
        await amoMinter.setStockMintCap(toWei("1"));
        expect(await amoMinter.stockMintCap()).to.be.eq(toWei("1"));
    });

    it('Call the function setAMOCorrectionOffsets', async function () {
        expect(await amoMinter.correctionOffsetsAmos(exchangeAMO.address, 0)).to.be.eq(0);
        expect(await amoMinter.correctionOffsetsAmos(exchangeAMO.address, 1)).to.be.eq(0);
        await amoMinter.setAMOCorrectionOffsets(
            exchangeAMO.address,
            toWei("1"),
            toWei("1")
        );
        expect(await amoMinter.correctionOffsetsAmos(exchangeAMO.address, 0)).to.be.eq(toWei("1"));
        expect(await amoMinter.correctionOffsetsAmos(exchangeAMO.address, 1)).to.be.eq(toWei("1"));
    });
});
