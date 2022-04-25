pragma solidity 0.8.10;

interface IBoost {
    function attachTokenToGauge(uint _tokenId, address account) external;

    function detachTokenFromGauge(uint _tokenId, address account) external;

    function emitDeposit(uint _tokenId, address account, uint amount) external;

    function emitWithdraw(uint _tokenId, address account, uint amount) external;

    function distribute(address _gauge) external;

    function weights(address _pool) external view returns (uint256);

    function votes(uint256 _tokeId, address _pool) external view returns (uint256);

    function usedWeights(uint256 _tokeId) external view returns (uint256);
}
