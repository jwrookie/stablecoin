const {ethers} = require("hardhat");
const {toWei, fromWei, toBN} = require("web3-utils");
const {deployContract} = require("ethereum-waffle");

const WETH = require('./mock/WETH9.json');
const Plain3Balances = require('./mock/mockPool/Plain3Balances.json');
const Plain3BalancesAbi = require('./mock/mockPool/3pool_abi.json');
const Factory = require('./mock/mockPool/factory.json');
const FactoryAbi = require('./mock/mockPool/factory_abi.json');
const Registry = require('./mock/mockPool/Registry.json');
const PoolRegistry = require('./mock/mockPool/PoolRegistry.json');
const Crypto3PoolMath = require('./mock/mockPool/Crypto3PoolMath.json');
const Crypto3PoolMathAbi = require('./mock/mockPool/Crypto3PoolMath_abi.json');
const Crypto3PoolView = require('./mock/mockPool/Crypto3PoolView.json');
const Crypto3PoolViewAbi = require('./mock/mockPool/Crypto3PoolView_abi.json');
const CurveLPToken = require('./mock/mockPool/CurveLPToken.json');
const CurveLPTokenAbi = require('./mock/mockPool/CurveLPToken_abi.json');
const CryptoBasePool = require('./mock/mockPool/CryptoBasePool.json');
const CryptoBasePoolAbi = require('./mock/mockPool/CryptoBasePool_abi.json');
const CryptoDepositZap = require('./mock/mockPool/CryptoDepositZap.json');
const CryptoDepositZapAbi = require('./mock/mockPool/CryptoDepositZap_abi.json');
const {expect} = require("chai");
const {time} = require("@openzeppelin/test-helpers");
const {BigNumber} = require("ethers");

contract('SwapRouter5Coins', () => {

    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        const zeroAddress = "0x0000000000000000000000000000000000000000";

        // mock token
        const MockToken = await ethers.getContractFactory("MockToken");
        token0 = await MockToken.deploy("token0", "token0", 18, toWei("0"));
        token1 = await MockToken.deploy("token1", "token1", 18, toWei("0"));
        token2 = await MockToken.deploy("token2", "token2", 18, toWei("0"));

        btc = await MockToken.deploy("btc", "btc", 18, toWei("0"));

        weth = await deployContract(owner, {
            bytecode: WETH.bytecode,
            abi: WETH.abi,
        });

        // mint
        await token0.mint(owner.address, toWei("1000"));
        await token1.mint(owner.address, toWei("1000"));
        await token2.mint(owner.address, toWei("1000"));
        await btc.mint(owner.address, toWei("1000"));
        await weth.deposit({value: toWei("1000")});

        expect(await token0.balanceOf(owner.address)).to.be.eq(toWei("1000"));
        expect(await token1.balanceOf(owner.address)).to.be.eq(toWei("1000"));
        expect(await token2.balanceOf(owner.address)).to.be.eq(toWei("1000"));
        expect(await btc.balanceOf(owner.address)).to.be.eq(toWei("1000"));
        expect(await weth.balanceOf(owner.address)).to.be.eq(toWei("1000"));

        // deploy plain3pool
        plain3Balances = await deployContract(owner, {
            bytecode: Plain3Balances.bytecode,
            abi: Plain3BalancesAbi.abi,
        });

        registry = await deployContract(owner, {
            bytecode: Registry.bytecode,
            abi: Registry.abi,
        }, [owner.address]);

        poolRegistry = await deployContract(owner, {
            bytecode: PoolRegistry.bytecode,
            abi: PoolRegistry.abi,
        }, [registry.address, zeroAddress]);

        await registry.set_address(0, poolRegistry.address);

        factory = await deployContract(owner, {
            bytecode: Factory.bytecode,
            abi: FactoryAbi.abi,
        }, [owner.address, poolRegistry.address]);

        await factory.set_plain_implementations(3, [
            plain3Balances.address,
            zeroAddress,
            zeroAddress,
            zeroAddress,
            zeroAddress,
            zeroAddress,
            zeroAddress,
            zeroAddress,
            zeroAddress,
            zeroAddress,
        ]);

        await factory.deploy_plain_pool(
            "pool3",
            "pool3",
            [token0.address, token1.address, token2.address, zeroAddress],
            "200",
            "4000000",
            0, 0, {gasLimit: "9500000"});
        const pool3Address = await factory.pool_list(0, {gasLimit: "9500000"});
        pool3 = await plain3Balances.attach(pool3Address);

        expect(pool3.address).to.be.eq(pool3Address);

        await token0.approve(pool3.address, toWei("1000"));
        await token1.approve(pool3.address, toWei("1000"));
        await token2.approve(pool3.address, toWei("1000"));

        await token0.connect(dev).approve(pool3.address, toWei("1000"));
        await token1.connect(dev).approve(pool3.address, toWei("1000"));
        await token2.connect(dev).approve(pool3.address, toWei("1000"));

        // deploy meta pool
        math = await deployContract(owner, {
            bytecode: Crypto3PoolMath.bytecode,
            abi: Crypto3PoolMathAbi.abi
        });

        view = await deployContract(owner, {
            bytecode: Crypto3PoolView.bytecode,
            abi: Crypto3PoolViewAbi.abi
        }, [math.address]);

        curveToken = await deployContract(owner, {
            bytecode: CurveLPToken.bytecode,
            abi: CurveLPTokenAbi.abi
        }, ["curveToken", "curveToken"]);

        metaPool = await deployContract(owner, {
            bytecode: CryptoBasePool.bytecode,
            abi: CryptoBasePoolAbi.abi
        }, [owner.address,
            dev.address,
            "3600000",// A
            "280000000000000",// gamma
            "5000000",// mid_fee
            "40000000",// out_fee
            "10000000000",// allowed_extra_profit
            "12000000000000000",// fee_gamma
            "5500000000000",// adjustment_step
            "0", // admin_fee
            "600",// ma_half_time
            [toWei("1"), toWei("1")],
            math.address,
            view.address,
            curveToken.address,
            [pool3.address, btc.address, weth.address]
        ]);

        await pool3.approve(metaPool.address, toWei("1000"));
        await btc.approve(metaPool.address, toWei("1000"));
        await weth.approve(metaPool.address, toWei("1000"));

        await curveToken.set_minter(metaPool.address);

        // depositZap
        depositZap = await deployContract(owner, {
            bytecode: CryptoDepositZap.bytecode,
            abi: CryptoDepositZapAbi.abi
        }, [metaPool.address, pool3.address]);

        await token0.approve(depositZap.address, toWei("1000"));
        await token1.approve(depositZap.address, toWei("1000"));
        await token2.approve(depositZap.address, toWei("1000"));
        await btc.approve(depositZap.address, toWei("1000"));
        await weth.approve(depositZap.address, toWei("1000"));

        await curveToken.approve(depositZap.address, toWei("1000"));

        await depositZap.add_liquidity([toWei("10"), toWei("10"), toWei("10"), toWei("10"), toWei("10")], 0, owner.address, {gasLimit: "9500000"});

        // Router
        Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();

        const CheckPermission = await ethers.getContractFactory("CheckPermission");
        checkPermission = await CheckPermission.deploy(operatable.address);

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");

        await fxs.setFraxAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        let _duration = time.duration.days(1);
        const Locker = await ethers.getContractFactory('Locker');
        locker = await Locker.deploy(checkPermission.address, fxs.address, parseInt(_duration));

        const SwapRouter = await ethers.getContractFactory('SwapRouter');
        swapRouter = await SwapRouter.deploy(weth.address);

        let latestBlock = await time.latestBlock();

        const SwapMining = await ethers.getContractFactory("SwapMining");
        swapMining = await SwapMining.deploy(
            checkPermission.address,
            locker.address,
            fxs.address,
            factory.address,
            swapRouter.address,
            "10000",
            parseInt(latestBlock),
            "10"
        );

        await swapRouter.setSwapMining(swapMining.address);
        await swapMining.addPair(100, depositZap.address, true);

        await fxs.addPool(swapMining.address);

        await token0.approve(swapRouter.address, toWei("10000"));
        await token1.approve(swapRouter.address, toWei("10000"));
        await token2.approve(swapRouter.address, toWei("10000"));
        await btc.approve(swapRouter.address, toWei("10000"));
        await weth.approve(swapRouter.address, toWei("10000"));

        const GaugeFactory = await ethers.getContractFactory('GaugeFactory');
        gaugeFactory = await GaugeFactory.deploy(checkPermission.address);
        let lastBlock = await time.latestBlock();

        Boost = await ethers.getContractFactory("Boost");
        boost = await Boost.deploy(
            checkPermission.address,
            locker.address,
            gaugeFactory.address,
            fxs.address,
            toWei('1'),
            parseInt(lastBlock),
            "1000"
        );

        await fxs.addPool(boost.address);
        await fxs.approve(locker.address, toWei('10000'));
    });

    it("test gauge deposit", async () => {
        await deposit_bind();

        let fraxOwnerBef = await frax.balanceOf(owner.address);
        let gaugeTotalBef = await gauge.totalSupply();

        await gauge.deposit(toWei("10"), tokenId);

        let fraxOwnerAft = await frax.balanceOf(owner.address);
        let gaugeTotalAft = await gauge.totalSupply();

        expect(fraxOwnerAft).to.be.eq(BigNumber.from(fraxOwnerBef).sub(toWei("10")));
        expect(gaugeTotalAft).to.be.eq(BigNumber.from(gaugeTotalBef).add(toWei("10")));

        let fxsOwnerBef = await fxs.balanceOf(owner.address);

        await boost.massUpdatePools();
        await gauge.getReward(owner.address);

        let fxsOwnerAft = await fxs.balanceOf(owner.address);
        expect(fxsOwnerAft).to.be.gt(fxsOwnerBef);
    });

    it('test gauge deposit with vote', async () => {
        await deposit_bind();

        let fraxOwnerBef = await frax.balanceOf(owner.address);
        let gaugeTotalBef = await gauge.totalSupply();

        await gauge.deposit(toWei("10"), tokenId);

        let fraxOwnerAft = await frax.balanceOf(owner.address);
        let gaugeTotalAft = await gauge.totalSupply();

        expect(fraxOwnerAft).to.be.eq(BigNumber.from(fraxOwnerBef).sub(toWei("10")));
        expect(gaugeTotalAft).to.be.eq(BigNumber.from(gaugeTotalBef).add(toWei("10")));

        let tokenWeightBef = await gaugeController.usedWeights(tokenId);

        await gaugeController.vote(tokenId, frax.address);

        let tokenWeightAft = await gaugeController.usedWeights(tokenId);
        expect(tokenWeightAft).to.be.gt(tokenWeightBef);

        let fxsOwnerBef = await fxs.balanceOf(owner.address);

        await gauge.getReward(owner.address);

        let fxsOwnerAft = await fxs.balanceOf(owner.address);
        expect(fxsOwnerAft).to.be.gt(fxsOwnerBef);
    });

    it('test gauge deposit with boost', async () => {
        await deposit_bind();

        let fraxOwnerBef = await frax.balanceOf(owner.address);
        let gaugeTotalBef = await gauge.totalSupply();

        await gauge.deposit(toWei("10"), tokenId);

        let fraxOwnerAft = await frax.balanceOf(owner.address);
        let gaugeTotalAft = await gauge.totalSupply();

        expect(fraxOwnerAft).to.be.eq(BigNumber.from(fraxOwnerBef).sub(toWei("10")));
        expect(gaugeTotalAft).to.be.eq(BigNumber.from(gaugeTotalBef).add(toWei("10")));

        await boost.vote(tokenId, [frax.address], [toWei("1")]);

        let fxsOwnerBef = await fxs.balanceOf(owner.address);

        await gauge.getReward(owner.address);

        let fxsOwnerAft = await fxs.balanceOf(owner.address);
        expect(fxsOwnerAft).to.be.gt(fxsOwnerBef);
    });

    it('test zap exchange_underlying', async () => {
        let token0OwnerBef = await token0.balanceOf(owner.address);
        let token0PoolBef = await token0.balanceOf(pool3.address);

        let wethOwnerBef = await weth.balanceOf(owner.address);
        let wethPoolBef = await weth.balanceOf(metaPool.address);

        await depositZap.exchange_underlying(0, 4, toWei("0.02"), 0, owner.address, {gasLimit: "9500000"});

        let token0OwnerAft = await token0.balanceOf(owner.address);
        let token0PoolAft = await token0.balanceOf(pool3.address);

        let wethOwnerAft = await weth.balanceOf(owner.address);
        let wethPoolAft = await weth.balanceOf(metaPool.address);

        expect(token0OwnerAft).to.be.eq(BigNumber.from(token0OwnerBef).sub(toWei("0.02")));
        expect(token0PoolAft).to.be.eq(BigNumber.from(token0PoolBef).add(toWei("0.02")));

        expect(BigNumber.from(wethOwnerAft).sub(wethOwnerBef)).to.be.eq(BigNumber.from(wethPoolBef).sub(wethPoolAft));
    });

    it('test swap mining', async () => {
        await swap_bind();

        let data = await depositZap.underlying_coins(0, {gasLimit: "9500000"});
        expect(data).to.be.eq(token0.address)

        const times = Number((new Date().getTime() + 1000).toFixed(0))
        await swapRouter.swapCryptoToken(depositZap.address, 0, 4, toWei("0.02"), 0, owner.address, times)
        let reword = await swapMining.rewardInfo(owner.address);

        let fxsBef = await fxs.balanceOf(owner.address);
        await swapMining.getReward(0);
        let fxsAft = await fxs.balanceOf(owner.address);

        let diff = fxsAft.sub(fxsBef);
        expect(diff).to.be.eq(reword.add("52500000000000000"));

        await swapRouter.swapCryptoToken(depositZap.address, 1, 0, "10000000", 0, owner.address, times);

        reword = await swapMining.rewardInfo(owner.address);
        await swapMining.getReward(0);

        let fxsAft1 = await fxs.balanceOf(owner.address);
        let diff1 = fxsAft1.sub(fxsAft);
        expect(diff1).to.be.eq(reword.mul(2));
    });

    it('test swap mining with vote', async () => {
        await swap_bind();
        let data = await depositZap.underlying_coins(0, {gasLimit: "9500000"});
        expect(data).to.be.eq(token0.address)

        const times = Number((new Date().getTime() + 1000).toFixed(0))
        await swapRouter.swapCryptoToken(depositZap.address, 0, 4, toWei("0.02"), 0, owner.address, times)
        let reword = await swapMining.rewardInfo(owner.address);

        let tokenWeightBef = await swapController.usedWeights(tokenId);

        await swapController.vote(tokenId, curveToken.address);

        let tokenWeightAft = await swapController.usedWeights(tokenId);
        expect(tokenWeightAft).to.be.gt(tokenWeightBef);

        let fxsBef = await fxs.balanceOf(owner.address);
        await swapMining.getReward(0);
        let fxsAft = await fxs.balanceOf(owner.address);

        expect(fxsAft).to.be.gt(fxsBef);
    });

    it('test swap mining with boost', async () => {
        await swap_bind();
        let data = await depositZap.underlying_coins(0, {gasLimit: "9500000"});
        expect(data).to.be.eq(token0.address)

        const times = Number((new Date().getTime() + 1000).toFixed(0))
        await swapRouter.swapCryptoToken(depositZap.address, 0, 4, toWei("2"), 0, owner.address, times)
        let reword = await swapMining.rewardInfo(owner.address);

        let fxsBef = await fxs.balanceOf(owner.address);
        await swapMining.getReward(0);
        let fxsAft = await fxs.balanceOf(owner.address);

        let diff = fxsAft.sub(fxsBef);
        expect(diff).to.be.eq(reword.add("52500000000000000"));

        // console.log(fromWei(toBN(diff)));

        await swapMining.vote(tokenId, [curveToken.address], [toWei("100")]);

        await swapRouter.swapCryptoToken(depositZap.address, 0, 4, toWei("0.02"), 0, owner.address, times);

        reword = await swapMining.rewardInfo(owner.address);
        await swapMining.getReward(0);

        let fxsAft1 = await fxs.balanceOf(owner.address);
        let diff1 = fxsAft1.sub(fxsAft);
        // console.log(fromWei(toBN(diff1)));
        expect(fxsAft1).to.be.gt(fxsAft);
    });

    it('test metaPool can swapCryptoToken', async () => {

        let times = Number((new Date().getTime() + 1000).toFixed(0));
        await swapRouter.swapCryptoToken(depositZap.address, 0, 1, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 0, 2, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 0, 3, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 0, 4, "10000000", 0, owner.address, times);

        await swapRouter.swapCryptoToken(depositZap.address, 1, 0, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 1, 2, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 1, 3, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 1, 4, "10000000", 0, owner.address, times);

        await swapRouter.swapCryptoToken(depositZap.address, 2, 0, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 2, 1, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 2, 3, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 2, 4, "10000000", 0, owner.address, times);

        await swapRouter.swapCryptoToken(depositZap.address, 3, 0, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 3, 1, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 3, 2, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 3, 4, "10000000", 0, owner.address, times);

        await swapRouter.swapCryptoToken(depositZap.address, 4, 0, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 4, 1, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 4, 2, "10000000", 0, owner.address, times);
        await swapRouter.swapCryptoToken(depositZap.address, 4, 3, "10000000", 0, owner.address, times);
    });

    async function deposit_bind() {
        await boost.createGauge(frax.address, "100", true);

        _duration = await boost.duration();
        const GaugeController = await ethers.getContractFactory('GaugeController');
        gaugeController = await GaugeController.deploy(
            checkPermission.address,
            boost.address,
            locker.address,
            _duration
        );
        await gaugeController.setDuration(_duration);
        await gaugeController.addPool(frax.address);
        expect(await gaugeController.getPool(0)).to.be.eq(frax.address);

        const gaugeAddress = await boost.gauges(frax.address);
        const Gauge = await ethers.getContractFactory("Gauge");
        gauge = await Gauge.attach(gaugeAddress);
        expect(gaugeAddress).to.be.eq(gauge.address);

        await locker.create_lock(toWei("1"), _duration);
        tokenId = await locker.tokenId();
        expect(tokenId).to.not.eq(0);

        await frax.approve(gaugeAddress, toWei("10000"));

        await boost.addController(gaugeController.address);
        await locker.addBoosts(gaugeController.address);
        await locker.addBoosts(boost.address);
    }

    async function swap_bind() {

        _duration = await boost.duration();
        const SwapController = await ethers.getContractFactory('SwapController');
        swapController = await SwapController.deploy(
            checkPermission.address,
            swapMining.address,
            locker.address,
            _duration
        );
        await swapController.setDuration(_duration);
        await swapController.addPool(curveToken.address);
        expect(await swapController.getPool(0)).to.be.eq(curveToken.address);

        await locker.create_lock(toWei("1"), _duration);
        tokenId = await locker.tokenId();
        expect(tokenId).to.not.eq(0);

        await curveToken.approve(swapMining.address, toWei("10000"));

        await swapMining.addController(swapController.address);
        await locker.addBoosts(swapController.address);
        await locker.addBoosts(swapMining.address);
    }
});