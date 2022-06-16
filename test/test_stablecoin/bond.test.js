const {ethers} = require("hardhat");
const {toWei} = web3.utils;
const Factory = require('../mock/PancakeFactory.json');
const Pair = require('../mock/PancakePair.json');
const Router = require('../mock/PancakeRouter.json');
const WETH = require('../mock/WETH9.json');
const {BigNumber} = require('ethers');
const {expect} = require("chai");
const {deployContract} = require('ethereum-waffle');

contract('BondIssuer', () => {
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

        const CheckPermission = await ethers.getContractFactory("CheckPermission");
        checkPermission = await CheckPermission.deploy(operatable.address);

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");

        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        expect(await fxs.oracle()).to.be.eq(oracle.address);
        expect(await frax.stockAddress()).to.be.eq(fxs.address);

        const PoolLibrary = await ethers.getContractFactory('PoolLibrary')
        poolLibrary = await PoolLibrary.deploy();

        const PoolUSD = await ethers.getContractFactory('PoolUSD', {
            libraries: {
                PoolLibrary: poolLibrary.address,
            },
        });
        pool = await PoolUSD.deploy(checkPermission.address, frax.address, fxs.address, usdc.address, toWei('100'));
        expect(await pool.usdAddress()).to.be.eq(usdc.address);


        const MockChainLink = await ethers.getContractFactory("MockChainLink");
        chainLink = await MockChainLink.deploy();

        const ChainlinkETHUSDPriceConsumer = await ethers.getContractFactory("ChainlinkETHUSDPriceConsumer");
        chainlinkETHUSDPriceConsumer = await ChainlinkETHUSDPriceConsumer.deploy(chainLink.address);
        await frax.setETHUSDOracle(chainlinkETHUSDPriceConsumer.address);

        await chainLink.setAnswer(toWei('100'));

        expect(await fxs.balanceOf(owner.address)).to.be.eq("300000000000000000000000000");
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
            Math.round(new Date() / 1000 + 260000000)
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
            Math.round(new Date() / 1000 + 260000000)
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
            Math.round(new Date() / 1000 + 260000000)
        );

        const UniswapPairOracle = await ethers.getContractFactory("UniswapPairOracle");
        usdc_uniswapOracle = await UniswapPairOracle.deploy(factory.address, usdc.address, weth.address);
        await pool.setCollatETHOracle(usdc_uniswapOracle.address, weth.address);

        frax_uniswapOracle = await UniswapPairOracle.deploy(factory.address, frax.address, weth.address);
        await frax.setStableEthOracle(frax_uniswapOracle.address, weth.address);
        expect(await frax.stableEthOracleAddress()).to.be.eq(frax_uniswapOracle.address);

        fxs_uniswapOracle = await UniswapPairOracle.deploy(factory.address, fxs.address, weth.address);
        await frax.setStockEthOracle(fxs_uniswapOracle.address, weth.address);
        expect(await frax.stockEthOracleAddress()).to.be.eq(fxs_uniswapOracle.address);


        const Bond = await ethers.getContractFactory("Bond");
        bond = await Bond.deploy(checkPermission.address, "Bond", "Bond");

        const BondIssuer = await ethers.getContractFactory('BondIssuer');
        bondIssuer = await BondIssuer.deploy(checkPermission.address, frax.address, bond.address);

        expect(await bondIssuer.stableCoin()).to.be.eq(frax.address);
        expect(await bondIssuer.bond()).to.be.eq(bond.address);
        await frax.addPool(pool.address);
        await frax.addPool(bondIssuer.address);
        await fxs.addPool(bondIssuer.address);

        await bond.addIssuer(bondIssuer.address);

        const Reserve = await ethers.getContractFactory('Reserve');
        reserve = await Reserve.deploy(checkPermission.address);

        await bondIssuer.setReserveAddress(reserve.address);
        expect(await bondIssuer.reserveAddress()).to.be.eq(reserve.address);
        await frax.approve(bondIssuer.address, toWei('10000'));
        await bond.approve(bondIssuer.address, toWei('10000'));


    });
    it('test addIssuer and removeIssuer  ', async () => {
        expect(await bond.isBondIssuers(owner.address)).to.be.eq(false);
        await bond.addIssuer(owner.address);
        expect(await bond.isBondIssuers(owner.address)).to.be.eq(true);
        expect(await bond.balanceOf(bondIssuer.address), 0);

        await bond.issuerMint(bondIssuer.address, "200000");
        await bond.issuerMint(owner.address, "100000");
        expect(await bond.balanceOf(bondIssuer.address)).to.be.eq("200000");
        expect(await bond.balanceOf(owner.address)).to.be.eq("100000");

        await bond.issuerBurnFrom(bondIssuer.address, "100000");
        expect(await bond.balanceOf(bondIssuer.address), "100000");

        await bond.removeIssuer(owner.address);
        expect(await bond.isBondIssuers(owner.address)).to.be.eq(false);

    });
    it('test mintBond and redeemBond', async () => {
        let bef = await frax.balanceOf(owner.address);
        let amount = "100000";

        expect(await bond.balanceOf(owner.address)).to.be.eq(0);
        expect(await frax.balanceOf(bondIssuer.address)).to.be.eq(0);
        expect(await bondIssuer.vBalStable(), 0);
        expect(await bondIssuer.fee()).to.be.eq(0);

        await bondIssuer.connect(owner).mintBond(amount);
        expect(await bondIssuer.fee()).to.be.eq("10");

        expect(await frax.balanceOf(bondIssuer.address)).to.be.eq(amount);

        let aft = await frax.balanceOf(owner.address);
        expect(aft).to.be.eq(bef.sub(amount))
        expect(await bondIssuer.vBalStable()).to.be.eq(amount);

        let rewardBef = await frax.balanceOf(owner.address);
        await bondIssuer.claimFee();

        let rewardAft = await frax.balanceOf(owner.address);
        let diff = rewardAft.sub(rewardBef);

        expect(diff).to.be.eq("10");

        await bondIssuer.redeemBond("55590");
        let rewardAft1 = await frax.balanceOf(owner.address);

        await bondIssuer.claimFee();
        let rewardAft2 = await frax.balanceOf(owner.address);
        let diff1 = rewardAft2.sub(rewardAft1);
        expect(diff1).to.be.eq("8");


    });
    it("two users mintBond and redeemBond", async () => {
        await frax.transfer(dev.address, toWei('100'));
        await frax.connect(dev).approve(bondIssuer.address, toWei('10000'));
        await bond.connect(dev).approve(bondIssuer.address, toWei('10000'));

        expect(await bond.balanceOf(owner.address)).to.be.eq(0);
        expect(await bond.balanceOf(dev.address)).to.be.eq(0);
        let amount = "100000";

        await bondIssuer.connect(owner).mintBond(amount);
        await bondIssuer.connect(dev).mintBond(amount);
        let befOwner = await frax.balanceOf(owner.address);
        let befDev = await frax.balanceOf(dev.address);
        let exchangeRate = await bondIssuer.exchangeRate();
        let bondOut = BigNumber.from(amount).mul(1e6).div(exchangeRate);
        let fees = await bondIssuer.fee();

        expect(await bond.balanceOf(owner.address)).to.be.eq(bondOut);
        expect(await bond.balanceOf(dev.address)).to.be.eq(bondOut);

        await bondIssuer.redeemBond(bondOut);
        await bondIssuer.connect(dev).redeemBond(bondOut);
        let exchangeRate1 = await bondIssuer.exchangeRate();

        let stableOut = bondOut.mul(exchangeRate).div(1e6);
        let stableFee = stableOut.mul(100).div(1e6);


        let AftOwner = await frax.balanceOf(owner.address);
        let AftDev = await frax.balanceOf(dev.address);

        let redeemBondFee = BigNumber.from(fees).sub(stableFee);
        expect(exchangeRate1).to.be.eq(exchangeRate);

        //Todo redeemBondFee is 11
        // expect(AftOwner).to.be.eq(befOwner.add(amount).sub(redeemBondFee));
        //expect(AftDev).to.be.eq(befDev.add(amount).sub(redeemBondFee));
    });
    it("exceeding maxinterestrate will fail", async () => {
        expect(await bondIssuer.interestRate()).to.be.eq(1e4);
        expect(await bondIssuer.minInterestRate()).to.be.eq(1e4);
        expect(await bondIssuer.maxInterestRate()).to.be.eq(1e5);
        await expect(bondIssuer.setInterestRate(1e6)).to.be.revertedWith("rate  in range");

        await expect(bondIssuer.connect(dev).setRangeInterestRate(1e5, 1e10)).to.be.revertedWith("not operator");
        await bondIssuer.setRangeInterestRate(1e5, 1e10);
        await bondIssuer.setInterestRate(1e6);
        expect(await bondIssuer.interestRate()).to.be.eq(1e6);
        expect(await bondIssuer.minInterestRate()).to.be.eq(1e5);
        expect(await bondIssuer.maxInterestRate()).to.be.eq(1e10);

    });
    it("exceeding maxinterestrate will fail", async () => {
        expect(await bondIssuer.interestRate()).to.be.eq(1e4);
        expect(await bondIssuer.minInterestRate()).to.be.eq(1e4);
        expect(await bondIssuer.maxInterestRate()).to.be.eq(1e5);
        await expect(bondIssuer.setInterestRate(1e6)).to.be.revertedWith("rate  in range");

        await expect(bondIssuer.connect(dev).setRangeInterestRate(1e5, 1e10)).to.be.revertedWith("not operator");
        await bondIssuer.setRangeInterestRate(1e5, 1e10);
        await bondIssuer.setInterestRate(1e6);
        expect(await bondIssuer.interestRate()).to.be.eq(1e6);
        expect(await bondIssuer.minInterestRate()).to.be.eq(1e5);
        expect(await bondIssuer.maxInterestRate()).to.be.eq(1e10);

    });
    it('bond token totalSupply > maxBondOutstanding', async () => {
        expect(await bondIssuer.currentInterestRate()).to.be.eq(1e4);
        let amount = toWei('1');
        await bondIssuer.mintBond(amount);

        expect(await bondIssuer.currentInterestRate()).to.be.eq(1e4);
        await bondIssuer.setMaxBondOutstanding(toWei('1'));
        await bondIssuer.mintBond(amount);
        let maxBondOutstanding = await bondIssuer.maxBondOutstanding();
        let totalSupply = await bond.totalSupply();

        let currentInterestRate = BigNumber.from(1e4).mul(maxBondOutstanding).div(totalSupply)

        expect(await bondIssuer.currentInterestRate()).to.be.eq(currentInterestRate);

        let exchangeRate = await bondIssuer.exchangeRate();
        let vBalStableBef = await bondIssuer.vBalStable();
        expect(vBalStableBef).to.be.eq(BigNumber.from(amount).mul(2));

        //1.3123755703912323
        let bondOut = BigNumber.from(vBalStableBef).mul(1e6).div(exchangeRate);
        let fraxBef = await frax.balanceOf(owner.address);

        await bondIssuer.redeemBond(toWei('1.3'));
        exchangeRate = await bondIssuer.exchangeRate();

        let stableOut = BigNumber.from(toWei('1.3')).mul(exchangeRate).div(1e6);
        let vBalStableAft = await bondIssuer.vBalStable();
        expect(vBalStableAft).to.be.eq(vBalStableBef.sub(stableOut));

        let fraxAft = await frax.balanceOf(owner.address);
        expect(fraxAft).to.be.gt(fraxBef);

    });
    it("issueFee and redemptionFee is 500", async () => {
        expect(await bondIssuer.issueFee()).to.be.eq(100);
        expect(await bondIssuer.redemptionFee()).to.be.eq(100);

        await bondIssuer.setFees(500, 500);
        expect(await bondIssuer.issueFee()).to.be.eq(500);
        expect(await bondIssuer.redemptionFee()).to.be.eq(500);
        let amount = "100000";

        await bondIssuer.mintBond(amount);
        let mintfee = await bondIssuer.issueFee();
        let stableFee = BigNumber.from(amount).mul(mintfee).div(1e6);
        let exchangeRate = await bondIssuer.exchangeRate();
        let fees = await bondIssuer.fee()
        expect(fees).to.be.eq(stableFee)

        let bondOut = BigNumber.from(amount).mul(1e6).div(exchangeRate);
        await bondIssuer.redeemBond(bondOut);
        exchangeRate = await bondIssuer.exchangeRate();
        let stableOut = BigNumber.from(bondOut).mul(exchangeRate).div(1e6);
        let stableFee1 = stableOut.mul(500).div(1e6);

        let fees1 = await bondIssuer.fee();
        expect(stableFee1).to.be.eq(fees1.sub(fees));


    });
      it('test bond recoverToken ', async () => {
        expect(await busd.balanceOf(bond.address)).to.be.eq(0);
        await busd.mint(bond.address, "1000");
        expect(await busd.balanceOf(bond.address)).to.be.eq("1000");
        await busd.approve(bond.address, toWei('1000'));

        await bond.recoverToken(busd.address, "1000");
        expect(await busd.balanceOf(bond.address)).to.be.eq(0);


    });
    it('test bondIssuer recoverToken ', async () => {
        expect(await busd.balanceOf(bondIssuer.address)).to.be.eq(0);
        await busd.mint(bondIssuer.address, "1000");
        expect(await busd.balanceOf(bondIssuer.address)).to.be.eq("1000");
        await busd.approve(bondIssuer.address, toWei('1000'));

        await bondIssuer.recoverToken(busd.address, "1000");
        expect(await busd.balanceOf(bondIssuer.address)).to.be.eq(0);


    });
    it("transfer the mintbond token to the reserve address and then take it out", async () => {
        let amount = "100000";
        await bondIssuer.connect(owner).mintBond(amount);
        let mintfee = await bondIssuer.issueFee();
        let stableFee = BigNumber.from(amount).mul(mintfee).div(1e6);
        let reserveAmount = BigNumber.from(amount).sub(stableFee);
        let befReserve = await frax.balanceOf(reserve.address);
        let exchangeRate = await bondIssuer.exchangeRate();
        let vBalStableBef = await bondIssuer.vBalStable();
        expect(vBalStableBef).to.be.eq(amount);
        let fees = await bondIssuer.fee()

        let bondOut = BigNumber.from(amount).mul(1e6).div(exchangeRate);
        expect(await bondIssuer.reserveAmount()).to.be.eq(BigNumber.from(amount).sub(fees));

        await bondIssuer.fetchReserve();

        let aftReserve = await frax.balanceOf(reserve.address);
        expect(await bondIssuer.reserveAmount()).to.be.eq(0);
        expect(aftReserve).to.be.gt(befReserve);
        expect(aftReserve).to.be.eq(reserveAmount);


        await bondIssuer.connect(owner).redeemBond(bondOut);
        exchangeRate = await bondIssuer.exchangeRate();

        let stableOut = BigNumber.from(bondOut).mul(exchangeRate).div(1e6);
        let vBalStableAft = await bondIssuer.vBalStable();
        expect(vBalStableAft).to.be.eq(vBalStableBef.sub(stableOut));

        let aft1 = await frax.balanceOf(reserve.address);
        expect(aft1).to.be.eq(reserveAmount);
        let fraxBef = await frax.balanceOf(owner.address);
        fees = await bondIssuer.fee();

        await bondIssuer.claimFee();
        let fraxAft = await frax.balanceOf(owner.address);

        expect(fraxAft).to.be.eq(fraxBef.add(fees));

        fees = await bondIssuer.fee();
        expect(fees).to.be.eq(0);

        let rAmount = aftReserve.add(1);
        await expect(reserve.fetchToken(frax.address, rAmount)).to.be.revertedWith("TRANSFER_FAILED");

        await expect(reserve.connect(dev).fetchToken(frax.address, aftReserve)).to.be.revertedWith("not operator");
        await reserve.fetchToken(frax.address, aftReserve);

        let fraxAft1 = await frax.balanceOf(owner.address);
        expect(fraxAft1).to.be.eq(fraxAft.add(aftReserve));


    });
    it("test globalCollateralValue", async () => {
        expect(await frax.stablePoolAddressCount()).to.be.eq(2);
        await usdc_uniswapOracle.setPeriod(1);
        await usdc_uniswapOracle.update();
        await frax_uniswapOracle.setPeriod(1);
        await frax_uniswapOracle.update();
        await fxs_uniswapOracle.setPeriod(1);
        await fxs_uniswapOracle.update();

        expect(await frax.globalCollateralValue()).to.be.eq(toWei('1'));
    });


});