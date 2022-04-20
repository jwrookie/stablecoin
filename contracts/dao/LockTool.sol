// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./Locker.sol";

contract LockerTool {
    struct Point {
        int128 bias;
        int128 slope; // # -dweight / dt
        uint256 ts;
        uint256 blk; // block
    }

    struct LockedBalance {
        int128 amount;
        uint256 end;
    }

    Locker public immutable locker;
    uint256 public supply;
    uint256 internal constant WEEK = 1 weeks;
    int128 internal constant iMAXTIME = 4 * 365 * 86400;
    uint256 internal constant MAXTIME = 4 * 365 * 86400;
    uint256 public epoch;
    uint256 internal constant MULTIPLIER = 1 ether;
    uint256 public immutable duration;

    constructor(address _locker, uint256 _duration) {
        locker = Locker(_locker);
        duration = _duration;
    }

    function calc_deposit_for(uint256 _value, uint256 _lock_duration)
        external
        view
        returns (uint256 bias)
    {
        LockedBalance memory _locked = LockedBalance(0, 0);

        uint256 unlock_time = ((block.timestamp + _lock_duration) / duration) *
            duration;

        uint256 supply_before = locker.supply();

        LockedBalance memory old_locked;
        require(_value > 0, "v >0");
        require(
            unlock_time > block.timestamp,
            "Can only lock until time in the future"
        );
        require(
            unlock_time <= block.timestamp + MAXTIME,
            "Voting lock can be 4 years max"
        );

        (old_locked.amount, old_locked.end) = (_locked.amount, _locked.end);
        // Adding to existing lock, or if a lock is expired - creating a new one
        _locked.amount += int128(int256(_value));
        if (unlock_time != 0) {
            _locked.end = unlock_time;
        }
        Point memory last_point = _checkpoint(1000, old_locked, _locked);
        last_point.bias -=
            last_point.slope *
            int128(int256(block.timestamp) - int256(last_point.ts));
        if (last_point.bias < 0) {
            last_point.bias = 0;
        }
        return uint256(int256(last_point.bias));
    }

    function calc_increase_deposit_for(uint256 _tokenId, uint256 _value)
        external
        view
        returns (uint256 bias)
    {
        (int128 amount, uint256 end) = locker.locked(_tokenId);

        uint256 unlock_time = 0;

        uint256 supply_before = locker.supply();

        LockedBalance memory old_locked;
        LockedBalance memory _locked = LockedBalance(amount, end);

        assert(_value > 0);
        // dev: need non-zero value
        require(_locked.amount > 0, "No existing lock found");
        require(
            _locked.end > block.timestamp,
            "Cannot add to expired lock. Withdraw"
        );

        (old_locked.amount, old_locked.end) = (_locked.amount, _locked.end);
        // Adding to existing lock, or if a lock is expired - creating a new one
        _locked.amount += int128(int256(_value));
        if (unlock_time != 0) {
            _locked.end = unlock_time;
        }
        Point memory last_point = _checkpoint(1000, old_locked, _locked);
        last_point.bias -=
            last_point.slope *
            int128(int256(block.timestamp) - int256(last_point.ts));
        if (last_point.bias < 0) {
            last_point.bias = 0;
        }
        return uint256(int256(last_point.bias));
    }

    function calc_increase_unlock_time(uint256 _tokenId, uint256 _lock_duration)
        external
        view
        returns (uint256)
    {
        LockedBalance memory _locked;

        (int128 amount, uint256 end) = locker.locked(_tokenId);
        _locked.amount = amount;
        _locked.end = end;
        uint256 unlock_time = ((block.timestamp + _lock_duration) / duration) *
            duration;

        LockedBalance memory old_locked;
        (old_locked.amount, old_locked.end) = (_locked.amount, _locked.end);

        Point memory last_point = _checkpoint(_tokenId, old_locked, _locked);

        last_point.bias -=
            last_point.slope *
            int128(int256(block.timestamp) - int256(last_point.ts));
        if (last_point.bias < 0) {
            last_point.bias = 0;
        }
        return uint256(int256(last_point.bias));
    }

    function _checkpoint(
        uint256 _tokenId,
        LockedBalance memory old_locked,
        LockedBalance memory new_locked
    ) internal view returns (Point memory last) {
        Point memory u_old;
        Point memory u_new;
        int128 old_dslope = 0;
        int128 new_dslope = 0;
        uint256 _epoch = locker.epoch();

        if (_tokenId != 0) {
            // Calculate slopes and biases
            // Kept at zero when they have to
            if (old_locked.end > block.timestamp && old_locked.amount > 0) {
                u_old.slope = old_locked.amount / iMAXTIME;
                u_old.bias =
                    u_old.slope *
                    int128(int256(old_locked.end - block.timestamp));
            }

            if (new_locked.end > block.timestamp && new_locked.amount > 0) {
                u_new.slope = new_locked.amount / iMAXTIME;
                u_new.bias =
                    u_new.slope *
                    int128(int256(new_locked.end - block.timestamp));
            }

            // Read values of scheduled changes in the slope
            // old_locked.end can be in the past and in the future
            // new_locked.end can ONLY by in the FUTURE unless everything expired: than zeros
            old_dslope = locker.slope_changes(old_locked.end);
            if (new_locked.end != 0) {
                if (new_locked.end == old_locked.end) {
                    new_dslope = old_dslope;
                } else {
                    new_dslope = locker.slope_changes(new_locked.end);
                }
            }
        }

        Point memory last_point = Point({
            bias: 0,
            slope: 0,
            ts: block.timestamp,
            blk: block.number
        });
        if (_epoch > 0) {
            (int128 bias, int128 slope, uint256 ts, uint256 blk) = locker
                .point_history(_epoch);
            last_point.bias = bias;
            last_point.slope = slope;
            last_point.ts = ts;
            last_point.blk = blk;
        }

        uint256 last_checkpoint = last_point.ts;
        // initial_last_point is used for extrapolation to calculate block number
        // (approximately, for *At methods) and save them
        // as we cannot figure that out exactly from inside the contract
        Point memory initial_last_point = last_point;
        uint256 block_slope = 0;
        // dblock/dt
        if (block.timestamp > last_point.ts) {
            block_slope =
                (MULTIPLIER * (block.number - last_point.blk)) /
                (block.timestamp - last_point.ts);
        }
        // If last point is already recorded in this block, slope=0
        // But that's ok b/c we know the block in such case

        // Go over weeks to fill history and calculate what the current point is
        {
            uint256 t_i = (last_checkpoint / duration) * duration;
            for (uint256 i = 0; i < 255; ++i) {
                // Hopefully it won't happen that this won't get used in 5 years!
                // If it does, users will be able to withdraw but vote weight will be broken
                t_i += duration;
                int128 d_slope = 0;
                if (t_i > block.timestamp) {
                    t_i = block.timestamp;
                } else {
                    d_slope = locker.slope_changes(t_i);
                }
                last_point.bias -=
                    last_point.slope *
                    int128(int256(t_i - last_checkpoint));
                last_point.slope += d_slope;
                if (last_point.bias < 0) {
                    // This can happen
                    last_point.bias = 0;
                }
                if (last_point.slope < 0) {
                    // This cannot happen - just in case
                    last_point.slope = 0;
                }
                last_checkpoint = t_i;
                last_point.ts = t_i;
                last_point.blk =
                    initial_last_point.blk +
                    (block_slope * (t_i - initial_last_point.ts)) /
                    MULTIPLIER;
                _epoch += 1;
                if (t_i == block.timestamp) {
                    last_point.blk = block.number;
                    break;
                } else {
                    // point_history[_epoch] = last_point;
                }
            }
        }

        // epoch = _epoch;
        // Now point_history is filled until t=now

        if (_tokenId != 0) {
            // If last point was in this block, the slope change has been applied already
            // But in such case we have 0 slope(s)
            last_point.slope += (u_new.slope - u_old.slope);
            last_point.bias += (u_new.bias - u_old.bias);
            if (last_point.slope < 0) {
                last_point.slope = 0;
            }
            if (last_point.bias < 0) {
                last_point.bias = 0;
            }
        }

        // // Record the changed point into history
        // point_history[_epoch] = last_point;

        if (_tokenId != 0) {
            // Schedule the slope changes (slope is going down)
            // We subtract new_user_slope from [new_locked.end]
            // and add old_user_slope to [old_locked.end]
            if (old_locked.end > block.timestamp) {
                // old_dslope was <something> - u_old.slope, so we cancel that
                old_dslope += u_old.slope;
                if (new_locked.end == old_locked.end) {
                    old_dslope -= u_new.slope;
                    // It was a new deposit, not extension
                }
                // slope_changes[old_locked.end] = old_dslope;
            }

            if (new_locked.end > block.timestamp) {
                if (new_locked.end > old_locked.end) {
                    new_dslope -= u_new.slope;
                    // old slope disappeared at this point
                    // slope_changes[new_locked.end] = new_dslope;
                }
                // else: we recorded it already in old_dslope
            }
            // Now handle user history
            // uint256 user_epoch = user_point_epoch[_tokenId] + 1;

            // user_point_epoch[_tokenId] = user_epoch;
            u_new.ts = block.timestamp;
            u_new.blk = block.number;
            // user_point_history[_tokenId][user_epoch] = u_new;
            return u_new;
        }
    }
}
