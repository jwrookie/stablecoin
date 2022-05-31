const {ethers} = require("hardhat");

async function main() {
    const account = await ethers.getSigners();

    let deployer = account[0];
    console.log("Deploy:\t" + deployer.address);

    let checkPermission = "0x87465916d6168fdC9f42B8649074B0EE361Eb061";
    let rusd = "0xc792dDbC43b0FB824D3B2916bb4BCa9dF113E9Ac";
    let tra = "0x707E9Dc22a38d7E14318Fea24EFe6848dd5D7bE9";
    let usdc = "0x1d870E0bDF106B8E515Ed0276ACa660c30a58D3A";
    let pool = "0x7Ca05dA8Fa3fa2EE8Fb4A7d257E2eEa7236C8310"; // pool3
    let stableCoinPool = "0x9c35e3C876583E126D661e52AF5E0DF216aDCbAf";
    let busd = "0xDde9d4B293F798a73A7986B978DC347F9cB70620";
    let weth = "0xABD262d7E300B250bab890f5329E817B7768Fe3C";
    let chainLink = "0x17E6A7C70c86078e57ef065EC71b1C18d62Df1f9";
    let usdcUniswapOracle = "0x2B172eD6C64a3B3A0E6F512EeDF5C0B73a23B259";
    let rusdUniswapOracle = "0x65a3a7343cEA06Da3079E661e10939975B60182E";
    let traUniswapOracle = "0xb52fE520BAB74F99c6E8949BC075b8b4f8455d49";
    let router = "0x18b284A13d8311b54cf10aC0F855c909894B6041";
    let firstAMOMinter = "0x596f6C224B3eC6C52Cb9C69cE874DDb27b10dDac";

    const AMOMinter = await ethers.getContractFactory('AMOMinter');
    let amoMinter = await AMOMinter.deploy(
        checkPermission,
        rusd,
        tra,
        usdc,
        stableCoinPool
    );
    console.log("AMOMinter:\t" + amoMinter.address);

    const ExchangeAMO = await ethers.getContractFactory('ExchangeAMO');
    let exchangeAMO = await ExchangeAMO.deploy(
        checkPermission,
        amoMinter.address,
        rusd,
        tra,
        usdc,
        pool,
        pool, // 3pool Lp address
        1,
        0
    );
    console.log("ExchangeAMO:\t" + exchangeAMO.address); // 0x8fCf14c7c6AaDeaA83b6abB6AbD4c17f095CBdAf
}

main()
    .then(() => console.log("Deploy Successfully!"))
    .catch((error) => {
        throw Error("Deploy fail! Error message:\t" + error);
    })