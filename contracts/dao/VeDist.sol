// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


interface VotingEscrow {

    struct Point {
        int128 bias;
        int128 slope; // # -dweight / dt
        uint256 ts;
        uint256 blk; // block
    }

    function user_point_epoch(uint tokenId) external view returns (uint);

    function epoch() external view returns (uint);

    function user_point_history(uint tokenId, uint loc) external view returns (Point memory);

    function point_history(uint loc) external view returns (Point memory);

    function checkpoint() external;

    function deposit_for(uint tokenId, uint value) external;

    function token() external view returns (address);
}

contract VeDist is Ownable {

    event CheckpointToken(uint time, uint tokens);

    event Claimed(uint tokenId, uint amount, uint claim_epoch, uint max_epoch);

    uint constant WEEK = 7 * 86400;

    uint public startTime;
    uint public timeCursor;
    mapping(uint => uint) public timeCursorOf;
    mapping(uint => uint) public userEpochOf;

    uint public lastTokenTime;
    uint[1000000000000000] public tokensPerWeek;

    address public votingEscrow;
    address public token;
    uint public tokenLastBalance;

    uint[1000000000000000] public veSupply;

    constructor(address _votingEscrow) {
        uint _t = block.timestamp / WEEK * WEEK;
        startTime = _t;
        lastTokenTime = _t;
        timeCursor = _t;
        address _token = VotingEscrow(_votingEscrow).token();
        token = _token;
        votingEscrow = _votingEscrow;
        IERC20(_token).approve(_votingEscrow, type(uint).max);
    }

    function timestamp() external view returns (uint) {
        return block.timestamp / WEEK * WEEK;
    }

    function _checkpointToken() internal {
        uint token_balance = IERC20(token).balanceOf(address(this));
        uint to_distribute = token_balance - tokenLastBalance;
        tokenLastBalance = token_balance;

        uint t = lastTokenTime;
        uint since_last = block.timestamp - t;
        lastTokenTime = block.timestamp;
        uint this_week = t / WEEK * WEEK;
        uint next_week = 0;

        for (uint i = 0; i < 20; i++) {
            next_week = this_week + WEEK;
            if (block.timestamp < next_week) {
                if (since_last == 0 && block.timestamp == t) {
                    tokensPerWeek[this_week] += to_distribute;
                } else {
                    tokensPerWeek[this_week] += to_distribute * (block.timestamp - t) / since_last;
                }
                break;
            } else {
                if (since_last == 0 && next_week == t) {
                    tokensPerWeek[this_week] += to_distribute;
                } else {
                    tokensPerWeek[this_week] += to_distribute * (next_week - t) / since_last;
                }
            }
            t = next_week;
            this_week = next_week;
        }
        emit CheckpointToken(block.timestamp, to_distribute);
    }

    function checkpointToken() external onlyOwner {
        _checkpointToken();
    }

    function _find_timestamp_epoch(address ve, uint _timestamp) internal view returns (uint) {
        uint _min = 0;
        uint _max = VotingEscrow(ve).epoch();
        for (uint i = 0; i < 128; i++) {
            if (_min >= _max) break;
            uint _mid = (_min + _max + 2) / 2;
            VotingEscrow.Point memory pt = VotingEscrow(ve).point_history(_mid);
            if (pt.ts <= _timestamp) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    function _find_timestamp_user_epoch(address ve, uint tokenId, uint _timestamp, uint max_user_epoch) internal view returns (uint) {
        uint _min = 0;
        uint _max = max_user_epoch;
        for (uint i = 0; i < 128; i++) {
            if (_min >= _max) break;
            uint _mid = (_min + _max + 2) / 2;
            VotingEscrow.Point memory pt = VotingEscrow(ve).user_point_history(tokenId, _mid);
            if (pt.ts <= _timestamp) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    function ve_for_at(uint _tokenId, uint _timestamp) external view returns (uint) {
        address ve = votingEscrow;
        uint max_user_epoch = VotingEscrow(ve).user_point_epoch(_tokenId);
        uint epoch = _find_timestamp_user_epoch(ve, _tokenId, _timestamp, max_user_epoch);
        VotingEscrow.Point memory pt = VotingEscrow(ve).user_point_history(_tokenId, epoch);
        return Math.max(uint(int256(pt.bias - pt.slope * (int128(int256(_timestamp - pt.ts))))), 0);
    }

    function _checkpoint_total_supply() internal {
        address ve = votingEscrow;
        uint t = timeCursor;
        uint rounded_timestamp = block.timestamp / WEEK * WEEK;
        VotingEscrow(ve).checkpoint();

        for (uint i = 0; i < 20; i++) {
            if (t > rounded_timestamp) {
                break;
            } else {
                uint epoch = _find_timestamp_epoch(ve, t);
                VotingEscrow.Point memory pt = VotingEscrow(ve).point_history(epoch);
                int128 dt = 0;
                if (t > pt.ts) {
                    dt = int128(int256(t - pt.ts));
                }
                veSupply[t] = Math.max(uint(int256(pt.bias - pt.slope * dt)), 0);
            }
            t += WEEK;
        }
        timeCursor = t;
    }

    function checkpointTotalSupply() external {
        _checkpoint_total_supply();
    }

    function _claim(uint _tokenId, address ve, uint _last_token_time) internal returns (uint) {
        uint user_epoch = 0;
        uint to_distribute = 0;

        uint max_user_epoch = VotingEscrow(ve).user_point_epoch(_tokenId);
        uint _start_time = startTime;

        if (max_user_epoch == 0) return 0;

        uint week_cursor = timeCursorOf[_tokenId];
        if (week_cursor == 0) {
            user_epoch = _find_timestamp_user_epoch(ve, _tokenId, _start_time, max_user_epoch);
        } else {
            user_epoch = userEpochOf[_tokenId];
        }

        if (user_epoch == 0) user_epoch = 1;

        VotingEscrow.Point memory user_point = VotingEscrow(ve).user_point_history(_tokenId, user_epoch);

        if (week_cursor == 0) week_cursor = (user_point.ts + WEEK - 1) / WEEK * WEEK;
        if (week_cursor >= lastTokenTime) return 0;
        if (week_cursor < _start_time) week_cursor = _start_time;

        VotingEscrow.Point memory old_user_point;

        for (uint i = 0; i < 50; i++) {
            if (week_cursor >= _last_token_time) break;

            if (week_cursor >= user_point.ts && user_epoch <= max_user_epoch) {
                user_epoch += 1;
                old_user_point = user_point;
                if (user_epoch > max_user_epoch) {
                    user_point = VotingEscrow.Point(0, 0, 0, 0);
                } else {
                    user_point = VotingEscrow(ve).user_point_history(_tokenId, user_epoch);
                }
            } else {
                int128 dt = int128(int256(week_cursor - old_user_point.ts));
                uint balance_of = Math.max(uint(int256(old_user_point.bias - dt * old_user_point.slope)), 0);
                if (balance_of == 0 && user_epoch > max_user_epoch) break;
                if (balance_of > 0) {
                    to_distribute += balance_of * tokensPerWeek[week_cursor] / veSupply[week_cursor];
                }
                week_cursor += WEEK;
            }
        }

        user_epoch = Math.min(max_user_epoch, user_epoch - 1);
        userEpochOf[_tokenId] = user_epoch;
        timeCursorOf[_tokenId] = week_cursor;

        emit Claimed(_tokenId, to_distribute, user_epoch, max_user_epoch);

        return to_distribute;
    }

    function _claimable(uint _tokenId, address ve, uint _last_token_time) internal view returns (uint) {
        uint user_epoch = 0;
        uint to_distribute = 0;

        uint max_user_epoch = VotingEscrow(ve).user_point_epoch(_tokenId);
        uint _start_time = startTime;

        if (max_user_epoch == 0) return 0;

        uint week_cursor = timeCursorOf[_tokenId];
        if (week_cursor == 0) {
            user_epoch = _find_timestamp_user_epoch(ve, _tokenId, _start_time, max_user_epoch);
        } else {
            user_epoch = userEpochOf[_tokenId];
        }

        if (user_epoch == 0) user_epoch = 1;

        VotingEscrow.Point memory user_point = VotingEscrow(ve).user_point_history(_tokenId, user_epoch);

        if (week_cursor == 0) week_cursor = (user_point.ts + WEEK - 1) / WEEK * WEEK;
        if (week_cursor >= lastTokenTime) return 0;
        if (week_cursor < _start_time) week_cursor = _start_time;

        VotingEscrow.Point memory old_user_point;

        for (uint i = 0; i < 50; i++) {
            if (week_cursor >= _last_token_time) break;

            if (week_cursor >= user_point.ts && user_epoch <= max_user_epoch) {
                user_epoch += 1;
                old_user_point = user_point;
                if (user_epoch > max_user_epoch) {
                    user_point = VotingEscrow.Point(0, 0, 0, 0);
                } else {
                    user_point = VotingEscrow(ve).user_point_history(_tokenId, user_epoch);
                }
            } else {
                int128 dt = int128(int256(week_cursor - old_user_point.ts));
                uint balance_of = Math.max(uint(int256(old_user_point.bias - dt * old_user_point.slope)), 0);
                if (balance_of == 0 && user_epoch > max_user_epoch) break;
                if (balance_of > 0) {
                    to_distribute += balance_of * tokensPerWeek[week_cursor] / veSupply[week_cursor];
                }
                week_cursor += WEEK;
            }
        }

        return to_distribute;
    }

    function claimable(uint _tokenId) external view returns (uint) {
        uint _last_token_time = lastTokenTime / WEEK * WEEK;
        return _claimable(_tokenId, votingEscrow, _last_token_time);
    }

    function claim(uint _tokenId) external returns (uint) {
        if (block.timestamp >= timeCursor) _checkpoint_total_supply();
        uint _last_token_time = lastTokenTime;
        _last_token_time = _last_token_time / WEEK * WEEK;
        uint amount = _claim(_tokenId, votingEscrow, _last_token_time);
        if (amount != 0) {
            VotingEscrow(votingEscrow).deposit_for(_tokenId, amount);
            tokenLastBalance -= amount;
        }
        return amount;
    }

    function claim_many(uint[] memory _tokenIds) external returns (bool) {
        if (block.timestamp >= timeCursor) _checkpoint_total_supply();
        uint _last_token_time = lastTokenTime;
        _last_token_time = _last_token_time / WEEK * WEEK;
        address _voting_escrow = votingEscrow;
        uint total = 0;

        for (uint i = 0; i < _tokenIds.length; i++) {
            uint _tokenId = _tokenIds[i];
            if (_tokenId == 0) break;
            uint amount = _claim(_tokenId, _voting_escrow, _last_token_time);
            if (amount != 0) {
                VotingEscrow(_voting_escrow).deposit_for(_tokenId, amount);
                total += amount;
            }
        }
        if (total != 0) {
            tokenLastBalance -= total;
        }
        return true;
    }

}
