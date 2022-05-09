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

        // // deploy plain3pool
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
            [toWei("0.08"), toWei("0.1")],
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
        lock = await Locker.deploy(checkPermission.address, fxs.address, parseInt(_duration));

        const SwapRouter = await ethers.getContractFactory('SwapRouter');
        swapRouter = await SwapRouter.deploy(weth.address);

        let latestBlock = await time.latestBlock();

        const SwapMining = await ethers.getContractFactory("SwapMining");
        swapMining = await SwapMining.deploy(
            checkPermission.address,
            lock.address,
            fxs.address,
            factory.address,
            swapRouter.address,
            "10000",
            parseInt(latestBlock),
            "10"
        );

        await swapRouter.setSwapMining(swapMining.address);
        await swapMining.addPair(100, depositZap.address, true);
        await lock.addBoosts(swapMining.address);
        await fxs.addPool(swapMining.address);
    });

    it('test zap', async () => {
        console.log(fromWei(toBN(await token0.balanceOf(owner.address, {gasLimit: "19500000"}))))
        console.log(fromWei(toBN(await depositZap.calc_token_amount([toWei("1"), toWei("1"), toWei("1"), toWei("1"), toWei("1")], true, {gasLimit: "19500000"}))))
    });

    it('test exchange_underlying', async () => {
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

        let token0OwnerBef = await token0.balanceOf(owner.address);
        let token0PoolBef = await token0.balanceOf(pool3.address);
        let wethOwnerBef = await weth.balanceOf(owner.address);
        let wethPoolBef = await weth.balanceOf(metaPool.address);

        console.log("token0OwnerBef: " + token0OwnerBef);
        console.log("token0PoolBef: " + token0PoolBef);
        console.log("wethOwnerBef: " + wethOwnerBef);
        console.log("wethPoolBef: " + wethPoolBef);

        await token0.approve(swapRouter.address, toWei("10000"))
        await token1.approve(swapRouter.address, toWei("10000"))
        await token2.approve(swapRouter.address, toWei("10000"))
        await btc.approve(swapRouter.address, toWei("10000"))
        await weth.approve(swapRouter.address, toWei("10000"))
        await curveToken.approve(swapRouter.address, toWei("10000"))

        await pool3.approve(swapRouter.address, toWei("10000"))
        await pool3.approve(depositZap.address, toWei("10000"))

        const times = Number((new Date().getTime() + 1000).toFixed(0))
        await swapRouter.swapCryptoToken(depositZap.address, 0, 4, toWei("0.02"), 0, owner.address, times)
        const reword = await swapMining.rewardInfo(owner.address);
        console.log("reword: " + reword);
    });
});