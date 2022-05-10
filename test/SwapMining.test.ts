const {expectRevert, time} = require('@openzeppelin/test-helpers');
const { ethers } = require('hardhat');

export const contract = async function getPakcage(packageName:string): Promise<object> {
    if (null == packageName || "" == packageName || undefined == typeof packageName) {
        return null;
    }
    return await ethers.getContractFactory(packageName);
}

export const duration = async function getDuration(day?:number) {

}