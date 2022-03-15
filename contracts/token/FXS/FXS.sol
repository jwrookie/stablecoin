// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.6.11;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../AbstractPausable.sol";
import "../Frax.sol";
import "../../Staking/Owned.sol";
import "../../Governance/AccessControl.sol";

contract FRAXShares is ERC20Burnable, AbstractPausable {
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */

    address public FRAXStablecoinAdd;

    uint256 public constant genesis_supply = 100000000e18; // 100M is printed upon genesis

    address public oracle_address;
    FRAXStablecoin private FRAX;

    /* ========== MODIFIERS ========== */

    modifier onlyPools() {
        require(FRAX.isFraxPools(msg.sender) == true, "Only frax pools can mint new FRAX");
        _;
    }

    /* ========== CONSTRUCTOR ========== */

    constructor (
        string memory _name,
        string memory _symbol,
        address _oracle_address
    ) public ERC20(_name, _symbol){
        require((_oracle_address != address(0)), "Zero address detected");
        oracle_address = _oracle_address;
        _mint(msg.sender, genesis_supply);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function setOracle(address new_oracle) external onlyOwner {
        require(new_oracle != address(0), "Zero address detected");

        oracle_address = new_oracle;
    }

    function setFRAXAddress(address frax_contract_address) external onlyOwner {
        require(frax_contract_address != address(0), "Zero address detected");

        FRAX = FRAXStablecoin(frax_contract_address);

        emit FRAXAddressSet(frax_contract_address);
    }

    function mint(address to, uint256 amount) public onlyPools {
        _mint(to, amount);
    }

    // This function is what other frax pools will call to mint new FXS (similar to the FRAX mint) 
    function pool_mint(address m_address, uint256 m_amount) external onlyPools {
        super._mint(m_address, m_amount);
        emit FXSMinted(address(this), m_address, m_amount);
    }

    // This function is what other frax pools will call to burn FXS 
    function pool_burn_from(address b_address, uint256 b_amount) external onlyPools {

        super.burnFrom(b_address, b_amount);
        emit FXSBurned(b_address, address(this), b_amount);
    }

    /* ========== OVERRIDDEN PUBLIC FUNCTIONS ========== */

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {

        _transfer(sender, recipient, amount);
        _approve(sender, _msgSender(), allowance(sender, _msgSender()).sub(amount, "ERC20: transfer amount exceeds allowance"));

        return true;
    }


    function add96(uint96 a, uint96 b, string memory errorMessage) internal pure returns (uint96) {
        uint96 c = a + b;
        require(c >= a, errorMessage);
        return c;
    }

    function sub96(uint96 a, uint96 b, string memory errorMessage) internal pure returns (uint96) {
        require(b <= a, errorMessage);
        return a - b;
    }

    /* ========== EVENTS ========== */

    /// @notice An event thats emitted when a voters account's vote balance changes
    event VoterVotesChanged(address indexed voter, uint previousBalance, uint newBalance);

    // Track FXS burned
    event FXSBurned(address indexed from, address indexed to, uint256 amount);

    // Track FXS minted
    event FXSMinted(address indexed from, address indexed to, uint256 amount);

    event FRAXAddressSet(address addr);
}
