FROM alpine:3.20

RUN apk add --no-cache wget unzip ca-certificates

ARG PB_VERSION=0.29.3

WORKDIR /pb

RUN wget -O /tmp/pb.zip https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip \
  && unzip /tmp/pb.zip -d /pb \
  && chmod +x /pb/pocketbase \
  && rm -f /tmp/pb.zip

COPY . .

EXPOSE 8080

CMD ["/bin/sh", "/pb/entrypoint.sh"]