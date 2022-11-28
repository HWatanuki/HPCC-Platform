LABEL=$1
[[ -z ${LABEL} ]] && LABEL=latest

docker image build -t hwatanuki/platform-core:8.8.6-rc2 \
     --build-arg DOCKER_REPO=hpccsystems \
     --build-arg BUILD_LABEL=${LABEL} \
     addbitcoin/ 

