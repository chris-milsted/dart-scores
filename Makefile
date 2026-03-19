# Dart Tracker — Makefile
# Convenience targets for building, running, and testing.

IMAGE   := dart-tracker:latest
CONTAINER := dart-tracker
TEST_PORT := 8080

.PHONY: build run run-hardened stop test test-unit test-security test-integration clean

## build: Build the Podman container image
build:
	podman build -t $(IMAGE) .

## run: Run the container (maps to host port 80)
run: build
	podman run --rm -p 80:8080 --name $(CONTAINER) $(IMAGE)

## run-hardened: Run with read-only filesystem (most secure)
run-hardened: build
	podman run --rm \
		--read-only \
		--tmpfs /var/cache/nginx:rw,size=10m \
		--tmpfs /var/run:rw,size=1m \
		-p 80:8080 \
		--name $(CONTAINER) \
		$(IMAGE)

## run-test: Start container for testing on port 8080
run-test: build
	podman run --rm -d -p $(TEST_PORT):8080 --name $(CONTAINER)-test $(IMAGE)

## stop-test: Stop the test container
stop-test:
	podman stop $(CONTAINER)-test || true

## test-unit: Run unit and security static-analysis tests
test-unit:
	cd tests && npm install && npm run test

## test-security: Run security header tests (requires running container)
test-security: run-test
	cd tests && npm install && APP_URL=http://localhost:$(TEST_PORT) npm run test:security; \
	$(MAKE) stop-test

## test-integration: Run Playwright integration tests (requires running container)
test-integration: run-test
	cd tests && npm install && npx playwright install --with-deps chromium && \
	APP_URL=http://localhost:$(TEST_PORT) npm run test:integration; \
	$(MAKE) stop-test

## test: Run all tests
test: test-unit test-security test-integration

## clean: Remove the container image
clean:
	podman rmi $(IMAGE) || true
