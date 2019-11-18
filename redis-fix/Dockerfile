FROM redis:alpine
VOLUME /mnt


# A bunch of fixes to get the configuration correct for alpine on MacOS
CMD echo 1 > /mnt/vm/overcommit_memory && \
#    echo 511 > /mnt/net/core/somaxconn && \
    echo never > /mnt/kernel/mm/transparent_hugepage/enabled && \
    echo never > /mnt/kernel/mm/transparent_hugepage/defrag
