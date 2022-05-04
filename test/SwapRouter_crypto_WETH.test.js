const CRVFactory = require('./mock/mockPool/CryptoFactory.json');
const FactoryAbi = require('./mock/mockPool/crpto_factory_abi.json');
const CurveCryptoSwap = require('./mock/mockPool/CurveCryptoSwap2ETH.json');

const PoolAbi = require('./mock/mockPool/curve_crypto_swap2_eth_abi.json');
const CurveToken = require("./mock/mockPool/CurveTokenV5.json")
const CurveTokenAbi = require("./mock/mockPool/curve_token_v5_abi.json")
const Registry = require("./mock/mockPool/Registry.json");
const PoolRegistry = require("./mock/mockPool/CryptoRegistry.json");

const {deployContract, MockProvider, solidity, Fixture} = require('ethereum-waffle');
const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {toWei} = web3.utils;
const WETH9 = require('./mock/WETH9.json');
const {BigNumber} = require('ethers');
const gas = {gasLimit: "9550000"};
const {expectRevert, time} = require('@openzeppelin/test-helpers');

contract('Crypto', () => {
    before(async () => {
        [owner, dev, addr1] = await ethers.getSigners();
        zeroAddr = "0x0000000000000000000000000000000000000000";

        const TestOracle = await ethers.getContractFactory('TestOracle');
        oracle = await TestOracle.deploy();

        const Operatable = await ethers.getContractFactory("Operatable");
        operatable = await Operatable.deploy();

        const FRAXShares = await ethers.getContractFactory('Stock');
        fxs = await FRAXShares.deploy(operatable.address, "fxs", "fxs", oracle.address);

        const FRAXStablecoin = await ethers.getContractFactory('RStablecoin');
        frax = await FRAXStablecoin.deploy(operatable.address, "frax", "frax");


        const MockToken = await ethers.getContractFactory("MockToken")

        usdc = await MockToken.deploy("usdc", "usdc", 18, toWei('10'));
        busd = await MockToken.deploy("busd", "busd", 18, toWei('10'));
        token0 = await MockToken.deploy("token0", "token0", 18, toWei('10'));
        token1 = await MockToken.deploy("token1", "token1", 18, toWei('10'));
        token2 = await MockToken.deploy("token2", "token2", 18, toWei('10'));
        token3 = await MockToken.deploy("token3", "token3", 18, toWei('10'));

        await token0.mint(owner.address, toWei("10000"));
        await token1.mint(owner.address, toWei("10000"));
        await token2.mint(owner.address, toWei("10000"));
        await token3.mint(owner.address, toWei("10000"));

        weth9 = await deployContract(owner, {
            bytecode: WETH9.bytecode,
            abi: WETH9.abi,
        });
        const SwapRouter = await ethers.getContractFactory('SwapRouter');
        swapRouter = await SwapRouter.deploy(weth9.address);

        expect(await weth9.balanceOf(owner.address)).to.be.eq(0);
        await weth9.deposit({value: toWei('10')});

        expect(await weth9.balanceOf(owner.address)).to.be.eq(toWei('10'));

        let lastBlock = await time.latestBlock();
        //console.log("lastBlock:" + lastBlock);

        await fxs.setFraxAddress(frax.address);
        await frax.setStockAddress(fxs.address);

        let eta = time.duration.days(1);
        const Locker = await ethers.getContractFactory('Locker');
        lock = await Locker.deploy(operatable.address, fxs.address, parseInt(eta));

        curveCryptoSwap = await deployContract(owner, {
            bytecode: CurveCryptoSwap.bytecode,
            abi: PoolAbi.abi
        }, [weth9.address])


        curveToken = await deployContract(owner, {
            bytecode: CurveToken.bytecode,
            abi: CurveTokenAbi.abi
        });

        crvFactory = await deployContract(owner, {
            bytecode: CRVFactory.bytecode,
            abi: FactoryAbi.abi,
        }, [owner.address,
            curveCryptoSwap.address,
            curveToken.address,
            zeroAddr,
            weth9.address])

        await crvFactory.deploy_pool(
            "3TestPo",
            "3TPo",
            [token0.address, weth9.address],
            3600000,
            toWei("0.00028"),
            "5000000",
            "40000000",
            10 ** 10,
            toWei("0.012"),
            "5500000000000",
            0,
            3600, toWei('0.01'), gas);
        poolAddress = await crvFactory.pool_list(0, gas);
        pool = await curveCryptoSwap.attach(poolAddress);

        expect(pool.address).to.be.eq(poolAddress);

        await token0.approve(pool.address, toWei("10000"));
        await weth9.approve(pool.address, toWei("10000"));

        coins1 = await pool.coins(0, gas);
        expect(coins1).to.be.eq(token0.address);
        coins2 = await pool.coins(1, gas);
        expect(coins2).to.be.eq(weth9.address);

        lpAddress = await crvFactory.get_token(pool.address);
        lp = await curveToken.attach(lpAddress);


        await pool.add_liquidity([toWei('1'), toWei('1')], 0, false, owner.address, gas);
        expect(await ethers.provider.getBalance(pool.address)).to.be.eq(toWei('1'));
        const n_coins = await pool.n_coins()
        expect(n_coins).to.be.eq(2);
        const SwapMining = await ethers.getContractFactory('SwapMining');
        swapMining = await SwapMining.deploy(
            operatable.address,
            lock.address,
            fxs.address,
            crvFactory.address,
            swapRouter.address,
            "10000",
            parseInt(lastBlock),
            "10"
        );

        await swapRouter.setSwapMining(swapMining.address);
        await swapMining.addPair(100, pool.address, true)

    });

    it("weth9 router exchange", async () => {
        let token0Bef = await token0.balanceOf(owner.address);
        let token0PoolBef = await token0.balanceOf(pool.address);
        let ethPoolBef = await ethers.provider.getBalance(pool.address);
        await token0.mint(owner.address, toWei('100000000000'))

        await token0.approve(swapRouter.address, toWei("10000"))
        await weth9.approve(swapRouter.address, toWei('100000'))
        // await token0.approve(pool.address, toWei("10000"))
        // await weth9.approve(pool.address, toWei('100000'))
        const times = Number((new Date().getTime() + 1000).toFixed(0))
        // await pool.exchange(1, 0, 1000, 0, true, owner.address, { value: 1000 })
        // await swapRouter.swapToken(pool.address, 0, 1, '1000', 0, owner.address, times, { ...gas })

        let token0Aft = await token0.balanceOf(owner.address);
        let token0PoolAft = await token0.balanceOf(pool.address);
        let ethPoolAft = await ethers.provider.getBalance(pool.address);

        // expect(token0Aft).to.be.eq(BigNumber.from(token0Bef).sub("1000"));
        // expect(token0PoolAft).to.be.eq(BigNumber.from(token0PoolBef).add("1000"));
        // expect(ethPoolAft).to.be.eq(BigNumber.from(ethPoolBef).sub("897"));

        const times2 = Number((new Date().getTime() + 1000).toFixed(0))

        await swapRouter.swapEthForToken(pool.address, 1, 0, 1000, 0, owner.address, times2, {value: 1000})

    });


    it("weth9 router exchange SwapMing", async () => {
        let token0Bef = await token0.balanceOf(owner.address);
        let token0PoolBef = await token0.balanceOf(pool.address);
        let ethPoolBef = await ethers.provider.getBalance(pool.address);

        await token0.approve(swapRouter.address, toWei("10000"))
        await weth9.approve(swapRouter.address, toWei('100000'))

        // const times = Number((new Date().getTime() + 1000).toFixed(0))
        // await swapRouter.swapToken(pool.address, 0, 1, '1000', 0, owner.address, times, { ...gas })


        let token0Aft = await token0.balanceOf(owner.address);
        let token0PoolAft = await token0.balanceOf(pool.address);
        let ethPoolAft = await ethers.provider.getBalance(pool.address);

        // expect(token0Aft).to.be.eq(BigNumber.from(token0Bef).sub("1000"));
        // expect(token0PoolAft).to.be.eq(BigNumber.from(token0PoolBef).add("1000"));
        // expect(ethPoolAft).to.be.eq(BigNumber.from(ethPoolBef).sub("897"));

        const times2 = Number((new Date().getTime() + 1000).toFixed(0))

        await swapRouter.swapEthForToken(pool.address, 0, 1, 100000000, 0, owner.address, times2, {value: 0})

        const reword = await swapMining.rewardInfo(owner.address)
        // expect(reword).to.be.eq('157500000000000000')

    });

});