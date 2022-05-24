const {BigNumber} = require('ethers');
const {MockTokenFactory} = require("../Factory/StableAndMockFactory");

const GetMockToken = async (deployMockTokenNumber, mintUser = [], mintNumber) => {
    let resultArray;
    let parameterMintNumber;

    if ("number" !== typeof deployMockTokenNumber && 0 >= deployMockTokenNumber) {
        throw Error("Please check token what you need!");
    }

     switch (typeof mintNumber) {
        case "number":
            if (0 < mintNumber) {
                parameterMintNumber = BigNumber.from(mintNumber.toString());
            }else {
                throw Error("Mint Number Will Be > 0!");
            }
            break;
        case "string":
            parameterMintNumber = mintNumber;
            break;
        default:
            throw Error("Type Error: Parameter is mintNumber!");
    }

    resultArray = await MockTokenFactory(deployMockTokenNumber, mintUser, parameterMintNumber);

    return resultArray;
}

module.exports = {
    GetMockToken
}