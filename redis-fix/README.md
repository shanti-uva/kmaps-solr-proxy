# Host VM fixes for Redis

## Requirements

Modifies the *redis:alpine* image.   Makes adjustments to the host vm required for Redis.  

_Needs to be a privileged container in order to modify the host container._

####Modified files and parameters

    echo 1 > /proc/vm/overcommit_memory && \
    echo never > /sys/kernel/mm/transparent_hugepage/enabled && \
    echo never > /sys/kernel/mm/transparent_hugepage/defrag

## Maintainer

**Yuji Shinozaki**

* Email: <yuji.shinozaki@gmail.com>
