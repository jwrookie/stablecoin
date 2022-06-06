const {ethers} = require("hardhat");
const CurveCryptoSwap3ETH = require('./mock/mockPool/CurveCryptoSwap3ETH.json');
const CurveCryptoSwap3ETHAbi = require('./mock/mockPool/CurveCryptoSwap3ETH_abi.json');
const Math = require('./mock/mockPool/Crypto3PoolMath.json');
const MathAbi = require('./mock/mockPool/Crypto3PoolMath_abi.json');
const PoolView = require('./mock/mockPool/Crypto3PoolView.json');
const PoolViewAbi = require('./mock/mockPool/Crypto3PoolView_abi.json');
const CurveTokenLpToken = require('./mock/mockPool/CurveLPToken.json');
const CurveTokenLpTokenAbi = require('./mock/mockPool/CurveLPToken_abi.json');
const WEth = require('./mock/WETH9.json');
const {deployContract} = require("ethereum-waffle");
const {BigNumber} = require("ethers");
const {time} = require("@openzeppelin/test-helpers");

const {toWei, fromWei, toBN, hexToString} = web3.utils;

contract('swap3eth_test', () => {
    beforeEach(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        const zeroAddress = "0x0000000000000000000000000000000000000000";

        const MockToken = await ethers.getContractFactory("MockToken");

        token0 = await MockToken.deploy("token0", "token0", 18, toWei("0"));
        token1 = await MockToken.deploy("token1", "token1", 18, toWei("0"));
        // token2 = await MockToken.deploy("token2", "token2", 18, toWei("0"));
        token2 = await deployContract(owner, {
            bytecode: WEth.bytecode,
            abi: WEth.abi,
        });

        await token0.mint(owner.address, toWei("1000"));
        await token1.mint(owner.address, toWei("1000"));
        // await token2.mint(owner.address, toWei("1000"));
        await token2.deposit({value: toWei("100")});

        math = await deployContract(owner, {
            bytecode: Math.bytecode,
            abi: MathAbi.abi
        });

        poolView = await deployContract(owner, {
            bytecode: PoolView.bytecode,
            abi: PoolViewAbi.abi
        }, [math.address]);

        curveToken = await deployContract(owner, {
            bytecode: CurveTokenLpToken.bytecode,
            abi: CurveTokenLpTokenAbi.abi
        }, ["curveToken", "curveToken"]);

        pool = await deployContract(owner, {
            bytecode: CurveCryptoSwap3ETH.bytecode,
            abi: CurveCryptoSwap3ETHAbi.abi
        }, [
            owner.address,
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
            poolView.address,
            curveToken.address,
            [token0.address, token1.address, token2.address]
        ]);

        await token0.approve(pool.address, toWei("1000"));
        await token1.approve(pool.address, toWei("1000"));
        await token2.approve(pool.address, toWei("1000"));

        await curveToken.set_minter(pool.address);

        await pool.add_liquidity([toWei('10'), toWei('10'), toWei('10')], 0, {gasLimit: "9500000"});


        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();

        const CheckPermission = await ethers.getContractFactory("CheckPermission");
        checkPermission = await CheckPermission.deploy(operatable.address);

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(checkPermission.address, "fxs", "fxs", oracle.address);
        await fxs.transfer(addr1.address, "299000000000000000000000000");

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(checkPermission.address, "frax", "frax");
        await fxs.setStableAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        let eta = time.duration.days(1);
        const Locker = await ethers.getContractFactory('Locker');
        lock = await Locker.deploy(checkPermission.address, fxs.address, parseInt(eta));

        const SwapRouter = await ethers.getContractFactory('SwapRouter');
        swapRouter = await SwapRouter.deploy(checkPermission.address, token2.address);

        const SwapMining = await ethers.getContractFactory('SwapMining');
        let lastBlock = await time.latestBlock();
        swapMining = await SwapMining.deploy(
            checkPermission.address,
            lock.address,
            fxs.address,
            pool.address,
            swapRouter.address,
            "10000",
            parseInt(lastBlock),
            "10"
        );

        await swapRouter.setSwapMining(swapMining.address);
        await swapMining.addPair(100, pool.address, true)

        await lock.addBoosts(swapMining.address);
        await fxs.approve(lock.address, toWei('10000'));
        await fxs.transfer(owner.address, toWei('10000'));

        await fxs.addPool(swapMining.address);
        const SwapController = await ethers.getContractFactory('SwapController');
        swapController = await SwapController.deploy(
            checkPermission.address,
            swapMining.address,
            lock.address,
            "300",
        );
        await swapMining.addController(swapController.address);
        await lock.addBoosts(swapController.address);

    });

    it('test exchange', async () => {
        await pool.add_liquidity([toWei("1"), toWei("1"), toWei("1")], 0, {gasLimit: "9500000"});

        let token0Bef = await token0.balanceOf(owner.address);
        let token2Bef = await token2.balanceOf(owner.address);
        let token0PoolBef = await token0.balanceOf(pool.address);
        let token2PoolBef = await token2.balanceOf(pool.address);

        let virtualPriceBef = await pool.get_virtual_price({gasLimit: 9500000});

        await pool.exchange(0, 2, toWei("1"), 0, false, {gasLimit: "9500000"})

        await token0.approve(swapRouter.address, toWei("10000"));
        await token1.approve(swapRouter.address, toWei("10000"));
        await token2.approve(swapRouter.address, toWei('100000'));

        let virtualPriceAft = await pool.get_virtual_price({gasLimit: 9500000});

        let token0Aft = await token0.balanceOf(owner.address);
        let token2Aft = await token2.balanceOf(owner.address);
        let token0PoolAft = await token0.balanceOf(pool.address);
        let token2PoolAft = await token2.balanceOf(pool.address);

        expect(token0Aft).to.be.eq(BigNumber.from(token0Bef).sub(toWei("1")));
        expect(token0PoolAft).to.be.eq(BigNumber.from(token0PoolBef).add(toWei("1")));

        expect(BigNumber.from(token2Aft).add(BigNumber.from(token2PoolAft))).to.be.eq(BigNumber.from(token2Bef).add(BigNumber.from(token2PoolBef)));

        expect(virtualPriceBef).to.not.eq(virtualPriceAft);
    });


    it('test crypto 3eth swapToken have reward', async () => {
        await pool.add_liquidity([toWei("1"), toWei("1"), toWei("1")], 0, {gasLimit: "9500000"});

        await token0.approve(swapRouter.address, toWei("10000"));
        await token1.approve(swapRouter.address, toWei("10000"));
        await token2.approve(swapRouter.address, toWei('100000'));

        let times = Number((new Date().getTime() / 1000 + 2600000).toFixed(0));

        //token0 -> weth
        await swapRouter.swapToken3(pool.address, 0, 2, toWei("1"), 0, owner.address, times);
        let reword = await swapMining.rewardInfo(owner.address);
        let bef = await fxs.balanceOf(owner.address);

        await swapMining.getReward(0);
        let aft = await fxs.balanceOf(owner.address);

        let diff = aft.sub(bef)
        expect(diff).to.be.eq(reword.add("52500000000000000"));

        //weth -> token0
        await swapRouter.swapToken3(pool.address, 2, 0, toWei("1"), 0, owner.address, times);

        reword = await swapMining.rewardInfo(owner.address);
        await swapMining.getReward(0);

        let aft1 = await fxs.balanceOf(owner.address);
        let diff1 = aft1.sub(aft);
        expect(diff1).to.be.eq(reword.mul(2));
    });

    it('test recover', async () => {
        let amountBef = await token0.balanceOf(swapRouter.address);

        await swapRouter.recoverERC20(token0.address, amountBef);

        let amountAft = await token0.balanceOf(swapRouter.address);

        expect(amountAft).to.be.eq(0);
    });
})