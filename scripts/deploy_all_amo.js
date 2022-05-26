const {ethers} = require("hardhat");
const {GetMockToken} = require("../test/Utils/GetMockConfig");
const {GetCRV, DeployThreePoolByCrvFactory} = require("../test/Tools/Deploy");
const {GetRusdAndTra, StableCoinPool} = require("../test/Utils/GetStableConfig");
const {GetUniswap, RouterApprove, SetETHUSDOracle} = require("../test/Utils/GetUniswapConfig");

async function main() {
    let rusd, tra, checkOpera, usdc, usdt, weth, factory;

    const account = await ethers.getSigners();
    
    let deployer = account[0];
    console.log("deployer:\t" + deployer.address);

    [rusd, tra, ,checkOpera] = await GetRusdAndTra();
    // console.log("rusd:\t" + rusd.address);
    // console.log("tra:\t" + tra.address);
    // console.log("checkPermission:\t" + checkOpera.address);

    // [usdc, usdt] = await GetMockToken(2, [deployer], toWei("1000"));
    // console.log("usdc:\t" + usdc.address);
    // console.log("usdt:\t" + usdt.address);
    //
    // let stableCoinPool = await StableCoinPool(usdc, toWei("10000000000"));
    // console.log("stableCoinPool:\t" + stableCoinPool.address);
    //
    // [weth, factory] = await GetCRV(deployer);
    // let pool = await DeployThreePoolByCrvFactory([rusd, usdc, usdt], {});
    //
    // // Create transaction pairs
    // await factory.createPair(usdc.address, weth.address);
    // await factory.createPair(rusd.address, weth.address);
    // await factory.createPair(tra.address, weth.address);
    //
    // await RouterApprove(usdc, toWei("1000"), [], deployer);
    // await RouterApprove(rusd, toWei("1000"), [toWei("0.5")], deployer);
    // await RouterApprove(tra, toWei("1000"), [toWei("0.1")], deployer);
    //
    // await SetETHUSDOracle();
    // let usdcUniswapOracle = await GetUniswap(deployer, stableCoinPool, factory, usdc, weth);
    // let rusdUniswapOracle = await GetUniswap(deployer, stableCoinPool, factory, rusd, weth);
    // let traUniswapOracle = await GetUniswap(deployer, stableCoinPool, factory, tra, weth);
    // console.log("usdcUniswapOracle:\t" + usdcUniswapOracle.address);
    // console.log("rusdUniswapOracle:\t" + rusdUniswapOracle.address);
    // console.log("traUniswapOracle:\t" + traUniswapOracle.address);
    //
    // const AMOMinter = await ethers.getContractFactory('AMOMinter');
    // let amoMinter = await AMOMinter.deploy(
    //     checkOpera.address,
    //     rusd.address,
    //     tra.address,
    //     usdc.address,
    //     stableCoinPool.address
    // );
    // console.log("AMOMinter:\t" + amoMinter.address);
    //
    // const ExchangeAMO = await ethers.getContractFactory('ExchangeAMO');
    // let exchangeAMO = await ExchangeAMO.deploy(
    //     checkOpera.address,
    //     amoMinter.address,
    //     rusd.address,
    //     tra.address,
    //     usdc.address,
    //     pool.address,
    //     pool.address, // 3pool Lp address
    //     1,
    //     0
    // );
    // console.log("ExchangeAMO:\t" + exchangeAMO.address);
}

main()
    .then(() => console.log("Deploy Successfully!"))
    .catch((error) => {
        throw Error("Deploy fail! Error message:\t" + error);
    })