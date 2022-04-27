pragma solidity 0.8.10;


interface IVeToken {
    function token() external view returns (address);
    function tokenOfOwnerByIndex(address _owner, uint _tokenIndex) external view returns (uint);
    function balanceOfNFT(uint) external view returns (uint);
    function isApprovedOrOwner(address, uint) external view returns (bool);
    function ownerOf(uint) external view returns (address);
    function transferFrom(address, address, uint) external;
    function voting(uint tokenId) external;
    function abstain(uint tokenId) external;
}

