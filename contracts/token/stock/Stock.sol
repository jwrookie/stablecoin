// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../../tools/AbstractPausable.sol";
import "../Rusd.sol";


contract Stock is ERC20Burnable, AbstractPausable {
    using SafeMath for uint256;

    address[] public poolAddress;
    mapping(address => bool) public isPools;

    address public FRAXStablecoinAdd;
    uint256 public constant GENESIS_SUPPLY = 100000000e18; // 100M is printed upon genesis
    address public oracle;
    RStablecoin private frax;

    modifier onlyPools() {
        require(isPools[msg.sender] == true, "Only pools can call this function");
        _;
    }

    constructor (
        address _operatorMsg,
        string memory _name,
        string memory _symbol,
        address _oracle

    ) public ERC20(_name, _symbol) AbstractPausable(_operatorMsg){
        require((_oracle != address(0)), "Zero address detected");
        oracle = _oracle;
        _mint(msg.sender, GENESIS_SUPPLY);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function setOracle(address new_oracle) external onlyOwner {
        require(new_oracle != address(0), "Zero address detected");
        oracle = new_oracle;
    }

    function setFraxAddress(address _address) external onlyOwner {
        require(_address != address(0), "Zero address detected");

        frax = RStablecoin(_address);

        emit FRAXAddressSet(_address);
    }

    function stablePoolAddressCount() public view returns (uint256) {
        return (poolAddress.length);
    }

    // Adds collateral addresses supported, such as tether and busd, must be ERC20
    function addPool(address pool_address) public onlyOwner {
        require(pool_address != address(0), "Zero address detected");
        require(isPools[pool_address] == false, "Address already exists");
        isPools[pool_address] = true;
        poolAddress.push(pool_address);

        emit PoolAdded(pool_address);
    }

    // Remove a pool
    function removePool(address pool_address) public onlyOwner {
        require(pool_address != address(0), "Zero address detected");
        require(isPools[pool_address] == true, "Address nonexistant");

        // Delete from the mapping
        delete isPools[pool_address];

        // 'Delete' from the array by setting the address to 0x0
        for (uint i = 0; i < poolAddress.length; i++) {
            if (poolAddress[i] == pool_address) {
                poolAddress[i] = address(0);
                // This will leave a null in the array and keep the indices the same
                break;
            }
        }
        emit PoolRemoved(pool_address);
    }

    function mint(address to, uint256 amount) public onlyPools returns (bool){
        _mint(to, amount);
        return true;
    }

    // This function is what other frax pools will call to mint new FXS (similar to the FRAX mint) 
    function poolMint(address to, uint256 amount) external onlyPools {
        super._mint(to, amount);
        emit FXSMinted(address(this), to, amount);
    }

    // This function is what other frax pools will call to burn FXS 
    function poolBurnFrom(address _address, uint256 _amount) external onlyPools {
        super.burnFrom(_address, _amount);
        emit FXSBurned(_address, address(this), _amount);
    }

    /* ========== EVENTS ========== */

    // Track FXS burned
    event FXSBurned(address indexed from, address indexed to, uint256 amount);

    // Track FXS minted
    event FXSMinted(address indexed from, address indexed to, uint256 amount);

    event FRAXAddressSet(address addr);

    event PoolAdded(address pool_address);

    event PoolRemoved(address pool_address);
}
