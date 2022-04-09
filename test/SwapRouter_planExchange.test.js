const CRVFactory = require('./mock/mockPool/factory.json');
const FactoryAbi = require('./mock/mockPool/factory_abi.json');
const Plain3Balances = require('./mock/mockPool/Plain3Balances.json');
const PoolAbi = require('./mock/mockPool/3pool_abi.json');
const Registry = require("./mock/mockPool/Registry.json");
const PoolRegistry = require("./mock/mockPool/CryptoRegistry.json");
const MetaPool = require('./mock/mockPool/MetaUSDBalances.json');
const MetaPoolAbi = require('./mock/mockPool/meta_pool.json');

const { waffle, ethers } = require("hardhat");
const { deployContract } = waffle;
const { expect } = require("chai");
const { toWei } = web3.utils;
const gas = { gasLimit: "9550000" };
const { BigNumber } = require('ethers');
contract('SwapRouter', () => {
  before(async () => {
    [owner, dev, addr1] = await ethers.getSigners();

    const SwapRouter = await ethers.getContractFactory('SwapRouter');
    swapRouter = await SwapRouter.deploy();

    const MockToken = await ethers.getContractFactory("MockToken")


    token0 = await MockToken.deploy("token0", "token0", 18, toWei('10'));
    token1 = await MockToken.deploy("token1", "token1", 18, toWei('10'));
    token2 = await MockToken.deploy("token2", "token2", 18, toWei('10'));
    token3 = await MockToken.deploy("token3", "token3", 18, toWei('10'));

    await token0.mint(owner.address, toWei("10000"));
    await token1.mint(owner.address, toWei("10000"));
    await token2.mint(owner.address, toWei("10000"));
    await token3.mint(owner.address, toWei("10000"));

    await token0.mint(dev.address, toWei("10"));
    await token1.mint(dev.address, toWei("10"));
    await token2.mint(dev.address, toWei("10"));

    plain3Balances = await deployContract(owner, {
      bytecode: Plain3Balances.bytecode,
      abi: PoolAbi.abi
    })

    registry = await deployContract(owner, {
      bytecode: Registry.bytecode,
      abi: Registry.abi
    }, [owner.address]);

    poolRegistry = await deployContract(owner, {
      bytecode: PoolRegistry.bytecode,
      abi: PoolRegistry.abi
    }, [registry.address]);


    await registry.set_address(0, poolRegistry.address);

    crvFactory = await deployContract(owner, {
      bytecode: CRVFactory.bytecode,
      abi: FactoryAbi.abi,
    }, [owner.address, registry.address])


    zeroAddr = "0x0000000000000000000000000000000000000000"

    await crvFactory.set_plain_implementations(3,
      [
        plain3Balances.address,
        zeroAddr,
        zeroAddr,
        zeroAddr,
        zeroAddr,
        zeroAddr,
        zeroAddr,
        zeroAddr,
        zeroAddr,
        zeroAddr])


    // create  token0 token1 token2
    await crvFactory.deploy_plain_pool(
      "3pool",
      "3pool",
      [token0.address, token1.address, token2.address, zeroAddr],
      "2000",
      "4000000", 0, 0, gas);

    poolAddress = await crvFactory.pool_list(0, gas);

    pool = await plain3Balances.attach(poolAddress);

    await token0.approve(pool.address, toWei("10000"))
    await token1.approve(pool.address, toWei("10000"))
    await token2.approve(pool.address, toWei("10000"))

    await pool.add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, gas)

    await poolRegistry.add_pool(poolAddress, 3, poolAddress, 18, "test", gas);

    await crvFactory.deploy_plain_pool(
      "3pool1",
      "3pool1",
      [poolAddress, token1.address, token2.address, zeroAddr],
      "2000",
      "4000000", 0, 0, gas);
    mulPoolAddress = await crvFactory.pool_list(1, gas);

    mulPool = await plain3Balances.attach(mulPoolAddress);
    await pool.approve(mulPool.address, toWei("10000"))
    await token1.approve(mulPool.address, toWei("10000"))
    await token2.approve(mulPool.address, toWei("10000"))

    await mulPool.add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, gas)

    // create  pool[token0 token1 token2], mulPool[pool token1 token2], token2
    await crvFactory.deploy_plain_pool(
      "3poo2",
      "3pool2",
      [pool.address, mulPool.address, token2.address, zeroAddr],
      "2000",
      "4000000", 0, 0, gas);
    mulPool2Address = await crvFactory.pool_list(2, gas);
    mulPool2 = await plain3Balances.attach(mulPool2Address);
    await token2.approve(mulPool2.address, toWei("10000"))
    await mulPool.approve(mulPool2.address, toWei("10000"))
    await pool.approve(mulPool2.address, toWei("10000"))

    await mulPool2.add_liquidity([toWei('100'), toWei('100'), toWei('100')], 0, gas)



  })

  it("exchange pool token0 -> token1", async () => {

    await token0.connect(dev).approve(pool.address, toWei("10000"))
    await token1.connect(dev).approve(pool.address, toWei("10000"))

    devToken0Befo = await token0.balanceOf(dev.address)
    devToken1Befo = await token1.balanceOf(dev.address)
    poolToken0Bef = await pool.balances(0, gas);
    poolToken1Bef = await pool.balances(1, gas);

    dx = '1000000'
    await pool.connect(dev).exchange(0, 1, dx, 0, dev.address);

    devToken0Aft = await token0.balanceOf(dev.address)
    devToken1Aft = await token1.balanceOf(dev.address)
    poolToken0aft = await pool.balances(0, { gasLimit: "2450000", });
    poolToken1aft = await pool.balances(1, { gasLimit: "2450000", });

    expect(devToken0Aft).to.be.eq(BigNumber.from(devToken0Befo).sub(dx))
    expect(devToken1Aft).to.be.eq(BigNumber.from(devToken1Befo).add("999600"))
    expect(poolToken0aft).to.be.eq(BigNumber.from(poolToken0Bef).add(dx))
    expect(poolToken1aft).to.be.eq(BigNumber.from(poolToken1Bef).sub('999799'))


  })


  it('swapRouter exchage  swapStable plan  token0 => token1', async () => {

    await token0.connect(owner).approve(swapRouter.address, toWei('10000'))
    await token1.connect(owner).approve(swapRouter.address, toWei('10000'))

    expect(await pool.coins(0, gas)).to.be.eq(token0.address)
    expect(await pool.coins(1, gas)).to.be.eq(token1.address)

    devToken0Befo = await token0.balanceOf(owner.address)
    devToken1Befo = await token1.balanceOf(owner.address)
    poolToken0Bef = await pool.balances(0, gas);
    poolToken1Bef = await pool.balances(1, gas);

    const times = Number((new Date().getTime() / 1000 + 1000).toFixed(0))
    let dx = "1000000"

    await swapRouter.connect(owner).swapStable(pool.address, 0, 1, dx, 0, owner.address, times)

    devToken0Aft = await token0.balanceOf(owner.address)
    devToken1Aft = await token1.balanceOf(owner.address)
    poolToken0aft = await pool.balances(0, gas);
    poolToken1aft = await pool.balances(1, gas);

    expect(devToken0Aft).to.be.eq(BigNumber.from(devToken0Befo).sub(dx))
    expect(devToken1Aft).to.be.eq(BigNumber.from(devToken1Befo).add("999600"))
    expect(poolToken0aft).to.be.eq(BigNumber.from(poolToken0Bef).add(dx))
    expect(poolToken1aft).to.be.eq(BigNumber.from(poolToken1Bef).sub('999799'))
  })







});
