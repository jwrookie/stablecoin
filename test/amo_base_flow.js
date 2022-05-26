const {toWei} = web3.utils;
const {ethers} = require("hardhat");
const {BigNumber} = require('ethers');
const {time} = require('@openzeppelin/test-helpers');
const {GetMockToken} = require("./Utils/GetMockConfig");
const {GetCRV, DeployThreePoolByCrvFactory} = require("./Tools/Deploy");
const {GetRusdAndTra, StableCoinPool} = require("./Utils/GetStableConfig");
const {GetUniswap, RouterApprove, SetETHUSDOracle} = require("./Utils/GetUniswapConfig");
const GAS = {gasLimit: "9550000"};

contract('Rsud、StableCoinPool、AMO、ExchangeAMO', async function () {
    beforeEach(async function () {
        [owner] = await ethers.getSigners();

        [rusd, tra, operatable] = await GetRusdAndTra();

        [usdc, token1] = await GetMockToken(2, [owner], toWei("1000"));

        stableCoinPool = await StableCoinPool(usdc, toWei("10000000000"));

        [weth, factory, registry, poolRegistry] = await GetCRV(owner);
        pool = await DeployThreePoolByCrvFactory([rusd, usdc, token1], {});

        // Create transaction pairs
        await factory.createPair(usdc.address, weth.address);
        await factory.createPair(rusd.address, weth.address);
        await factory.createPair(tra.address, weth.address);

        await RouterApprove(usdc, toWei("1000"), [], owner);
        await RouterApprove(rusd, toWei("1000"), [toWei("0.5")], owner);
        await RouterApprove(tra, toWei("1000"), [toWei("0.1")], owner);

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
        await registry.set_address(0, poolRegistry.address);

        // Approve for pool
        await usdc.approve(pool.address, toWei("10000"));
        await token1.approve(pool.address, toWei("10000"));
        await rusd.approve(pool.address, toWei("10000"));

        // Add liquidity
        await pool.add_liquidity([toWei("100"), toWei("100"), toWei("100")], 0, GAS);
        await amoMinter.addAMO(exchangeAMO.address, true); // Because will call the function dollarBalances and find get lpBalance in 3pool so need to add liquidity in 3pool
        await stableCoinPool.addAMOMinter(amoMinter.address); // Because amo will borrow usdc from stable coin pool
    });

    it('when user mint rusd will trigger exchange amo and do not with draw rusd', async function () {
        // Because minting needs to obtain the price of collateral to USD, the predictor needs to be refreshed
        await time.increase(await time.duration.hours(1));
        await usdcUniswapOracle.update();

        await stableCoinPool.mint1t1Stable(toWei("1"), 0);

        await amoMinter.setMinimumCollateralRatio(0);
        await amoMinter.mintStableForAMO(exchangeAMO.address, toWei("1"));

        await amoMinter.setCollatBorrowCap(toWei("10"));
        await amoMinter.giveCollatToAMO(exchangeAMO.address, toWei("1"));

        await exchangeAMO.poolDeposit(toWei("0.5"), toWei("0.1"));

        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq(toWei("0.5"));
        await exchangeAMO.poolWithdrawStable(await pool.balanceOf(exchangeAMO.address, GAS), true);
        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq(toWei("0.5"));
    });

    it('when user mint rusd will trigger exchange amo and with draw', async function () {
        // Because minting needs to obtain the price of collateral to USD, the predictor needs to be refreshed
        await time.increase(await time.duration.hours(1));
        await usdcUniswapOracle.update();

        await stableCoinPool.mint1t1Stable(toWei("1"), 0);

        await amoMinter.setMinimumCollateralRatio(0);
        await amoMinter.mintStableForAMO(exchangeAMO.address, toWei("1"));

        await amoMinter.setCollatBorrowCap(toWei("10"));
        await amoMinter.giveCollatToAMO(exchangeAMO.address, toWei("1"));

        await exchangeAMO.poolDeposit(toWei("0.5"), toWei("0.1"));

        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(BigNumber.from("1000000000000000000").sub(toWei("0.1")));
        await exchangeAMO.poolWithdrawCollateral(await pool.balanceOf(exchangeAMO.address, GAS));
        expect(await rusd.balanceOf(exchangeAMO.address)).to.be.eq("500000000000000000");
    });

    it('No borrowing, no collateral coinage, investment profit', async function () {
        // Because minting needs to obtain the price of collateral to USD, the predictor needs to be refreshed
        await time.increase(await time.duration.hours(1));
        await usdcUniswapOracle.update();

        await amoMinter.setMinimumCollateralRatio(0);
        await amoMinter.mintStableForAMO(exchangeAMO.address, toWei("1"));

        await exchangeAMO.poolDeposit(toWei("0.5"), 0);

        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(0);
        await exchangeAMO.poolWithdrawCollateral(await pool.balanceOf(exchangeAMO.address, GAS));
        expect(await usdc.balanceOf(exchangeAMO.address)).to.be.eq(BigNumber.from("499798771300969441"));

        // Add check logic
        // await exchangeAMO.giveCollatBack(await usdc.balanceOf(exchangeAMO.address));
    });

    it('Borrowing stable coin and get reward by amo', async function () {
        // Because minting needs to obtain the price of collateral to USD, the predictor needs to be refreshed
        await time.increase(await time.duration.hours(1));
        await usdcUniswapOracle.update();

        expect(await rusd.globalCollateralRatio()).to.be.eq(BigNumber.from("1000000"));
    });
});
