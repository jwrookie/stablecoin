const {GetConfigAboutCRV} = require("./Tools/Deploy");
const {StableCoinPool, GetRusdAndTra, SetRusdAndTraConfig} = require("./Utils/GetStableConfig");
const {SetArray} = require("./Tools/Oprate");
const {GetMockToken} = require("./Utils/GetMockConfig");
const {Signers} = require("./Core/WalletConfig");
const {BigNumber} = require('ethers');
const {toWei} = web3.utils;

contract('Test' , async function () {
   beforeEach('test', async function () {
       // factory = await Factory();
       // weth = await Weth();
       // router = await Router(factory, weth);

       // const TestOracle = await ethers.getContractFactory('TestOracle');
       // testOracle = await TestOracle.deploy();
       // const testOperatable = await ethers.getContractFactory('Operatable');
       // operatable = await testOperatable.deploy();
       //
       // const RStableCoin = await ethers.getContractFactory('RStablecoin');
       // frax = await RStableCoin.deploy(operatable.address, "frax", "frax");
       //
       // const Stock = await ethers.getContractFactory('Stock');
       // fxs = await Stock.deploy(operatable.address, "fxs", "fxs", testOracle.address);

       [owner, dev] = await Signers();
       console.log("---" + owner.address);
       console.log("---" + dev.address);
       [weth, factory, router, registry, poolRegistry] = await GetConfigAboutCRV(owner);
       [operatable, frax, fxs] = await GetRusdAndTra();
       console.log(operatable.address);
       // console.log(frax.address);
       // console.log(fxs.address);
       console.log(weth.address);
       // console.log(factory.address);
       // console.log(router.address);
       // console.log(await GetConfigAboutCRV(owner))
       // console.log(registry.address);
       // console.log(poolRegistry.address);

       // Set each other
       await SetRusdAndTraConfig(frax, fxs);

       // Mock token Date
       // const MockToken = await ethers.getContractFactory("MockToken");
       // usdc = await MockToken.deploy("usdc", "usdc", 18, BigNumber.from("1000000000000000000"));
       [usdc, token0] = await GetMockToken(1,[owner.address, dev.address]);
       console.log(await usdc.balanceOf(owner.address));
       console.log("usdc" + usdc)
       console.log(usdc.address);
       // console.log(token0.address);
       // await usdc.mint(owner.address, toWei("1"));
       // console.log(await usdc.balanceOf(owner.address));
       // await MintMockToken(usdc, owner.address, toWei("1"));
       // console.log(await usdc.balanceOf(owner.address));
       console.log(await usdc.balanceOf(dev.address));
       // await usdc.mint(dev.address, toWei("1"));
       // console.log(await usdc.balanceOf(dev.address));
       // console.log(usdc.address);
       console.log("2");
       console.log(await SetArray(10, [usdc.address]));
       console.log(await SetArray(4, [usdc.address, frax.address, fxs.address]));

       // Mint for account
       // await usdc.mint(owner.address, toWei("1000"));
       // await usdc.mint(dev.address, toWei("1000"));
       // registry = await Registry();
       stableCoinPool = await StableCoinPool(operatable, frax, fxs, usdc, 10000);
   });
    it('should test', async function () {
        console.log(weth.address);
        console.log(factory.address);
        console.log(router.address);
        console.log(stableCoinPool.address);
    });
});