// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ICaskJobQueue.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";


abstract contract CaskJobQueue is
Initializable,
OwnableUpgradeable,
PausableUpgradeable,
KeeperCompatibleInterface,
ICaskJobQueue
{

    /** @dev size (in seconds) of buckets to group jobs into for processing */
    uint32 public queueBucketSize;

    /** @dev map used to track jobs in the queues */
    mapping(uint8 => mapping(uint32 => bytes32[])) private queue; // renewal bucket => workUnit[]
    mapping(uint8 => uint32) private queueBucket; // current bucket being processed


    function __CaskJobQueue_init(
        uint32 _queueBucketSize
    ) internal onlyInitializing {
        __Ownable_init();
        __Pausable_init();
        __ICaskJobQueue_init_unchained();
        __CaskJobQueue_init_unchained(_queueBucketSize);
    }

    function __CaskJobQueue_init_unchained(
        uint32 _queueBucketSize
    ) internal onlyInitializing {
        queueBucketSize = _queueBucketSize;
    }


    function bucketAt(
        uint32 _timestamp
    ) internal view returns(uint32) {
        return _timestamp - (_timestamp % queueBucketSize) + queueBucketSize;
    }

    function currentBucket() internal view returns(uint32) {
        uint32 timestamp = uint32(block.timestamp);
        return timestamp - (timestamp % queueBucketSize);
    }

    function queueItem(
        uint8 _queueId,
        uint32 _bucket,
        uint256 _idx
    ) external override view returns(bytes32) {
        return queue[_queueId][_bucket][_idx];
    }

    function queueSize(
        uint8 _queueId,
        uint32 _bucket
    ) external override view returns(uint256) {
        return queue[_queueId][_bucket].length;
    }

    function queuePosition(
        uint8 _queueId
    ) external override view returns(uint32) {
        return queueBucket[_queueId];
    }

    function setQueuePosition(
        uint8 _queueId,
        uint32 _timestamp
    ) external override onlyOwner {
        queueBucket[_queueId] = bucketAt(_timestamp);
    }

    function checkUpkeep(
        bytes calldata checkData
    ) external view override returns(bool upkeepNeeded, bytes memory performData) {
        (
        uint256 limit,
        uint256 minDepth,
        uint8 queueId
        ) = abi.decode(checkData, (uint256, uint256, uint8));

        uint32 bucket = currentBucket();
        upkeepNeeded = false;

        uint32 checkBucket = queueBucket[queueId];
        if (checkBucket == 0) {
            checkBucket = bucket;
        }

        // if queue is more than an hour old, all hands on deck
        if (bucket >= checkBucket && bucket - checkBucket > (queueBucketSize * 20)) {
            upkeepNeeded = true;
        } else {
            while (checkBucket <= bucket) {
                if (queue[queueId][checkBucket].length > 0 &&
                    queue[queueId][checkBucket].length >= minDepth)
                {
                    upkeepNeeded = true;
                    break;
                }
                checkBucket += queueBucketSize;
            }
        }

        performData = abi.encode(limit, queue[queueId][checkBucket].length, queueId);
    }


    function performUpkeep(
        bytes calldata performData
    ) external override whenNotPaused {
        (
        uint256 limit,
        uint256 depth,
        uint8 queueId
        ) = abi.decode(performData, (uint256, uint256, uint8));

        uint32 bucket = currentBucket();
        uint256 jobsProcessed = 0;
        uint256 maxBucketChecks = limit * 5;

        if (queueBucket[queueId] == 0) {
            queueBucket[queueId] = bucket;
        }

        while (jobsProcessed < limit && maxBucketChecks > 0 && queueBucket[queueId] <= bucket) {
            uint256 queueLen = queue[queueId][queueBucket[queueId]].length;
            if (queueLen > 0) {
                bytes32 workUnit = queue[queueId][queueBucket[queueId]][queueLen-1];
                queue[queueId][queueBucket[queueId]].pop();
                processWorkUnit(queueId, workUnit);
                emit WorkUnitProcessed(queueId, workUnit);
                jobsProcessed += 1;
            } else {
                if (queueBucket[queueId] < bucket) {
                    queueBucket[queueId] += queueBucketSize;
                    maxBucketChecks -= 1;
                } else {
                    break; // nothing left to do
                }
            }
        }

        emit QueueRunReport(limit, jobsProcessed, depth, queueId,
            queue[queueId][queueBucket[queueId]].length, queueBucket[queueId]);
    }


    function scheduleWorkUnit(
        uint8 _queueId,
        bytes32 _workUnit,
        uint32 _processAt
    ) internal override {
        queue[_queueId][bucketAt(_processAt)].push(_workUnit);
        emit WorkUnitQueued(_queueId, _workUnit, _processAt);
    }

    function setQueueBucketSize(
        uint32 _queueBucketSize
    ) external override onlyOwner {
        queueBucketSize = _queueBucketSize;
    }

}