import asyncio
from unittest.mock import AsyncMock, patch
from mcp_server.vercel_client import VercelClient, VercelClientError

async def test_vercel_client():
    print("Testing Vercel Client...")
    
    # 1. Test get_build_logs (Existing)
    print("\n[1] Testing get_build_logs...")
    mock_log_response = ""
    for i in range(160):
        mock_log_response += f'{{"type": "stdout", "text": "Log line {i}\\n"}}\n'
    
    with patch('httpx.AsyncClient') as mock_client_cls:
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__.return_value = mock_client
        
        # Mock for logs
        mock_client.get.return_value = AsyncMock(status_code=200, text=mock_log_response)
        
        client = VercelClient(token="fake_token")
        logs = await client.get_build_logs("dpl_123")
        
        if len(logs.split('\n')) == 151:
            print("SUCCESS: Log truncation works")
        else:
            print(f"FAILED: Expected 151 lines, got {len(logs.split('\n'))}")

        # 2. Test list_deployments
        print("\n[2] Testing list_deployments...")
        mock_list_response = {
            "deployments": [
                {"uid": "dpl_1", "name": "proj1", "state": "READY", "url": "proj1.vercel.app", "created": 123456},
                {"uid": "dpl_2", "name": "proj1", "state": "ERROR", "created": 123455}
            ]
        }
        mock_client.request.return_value = AsyncMock(status_code=200, json=lambda: mock_list_response)
        
        deps = await client.list_deployments("proj1", limit=2)
        if len(deps) == 2 and deps[0]["state"] == "READY":
            print("SUCCESS: list_deployments returned correct data")
        else:
            print(f"FAILED: list_deployments data mismatch: {deps}")
            
        # 3. Test get_deployment_details
        print("\n[3] Testing get_deployment_details...")
        mock_detail_response = {"id": "dpl_1", "readyState": "READY"}
        mock_client.request.return_value = AsyncMock(status_code=200, json=lambda: mock_detail_response)
        
        details = await client.get_deployment_details("dpl_1")
        if details["id"] == "dpl_1":
            print("SUCCESS: get_deployment_details returned correct data")
        else:
            print(f"FAILED: get_deployment_details mismatch")

        # 4. Test set_env_var
        print("\n[4] Testing set_env_var...")
        mock_env_response = {"key": "TEST_KEY", "value": "TEST_VAL", "target": ["production"]}
        mock_client.request.return_value = AsyncMock(status_code=200, json=lambda: mock_env_response)
        
        env = await client.set_env_var("proj1", "TEST_KEY", "TEST_VAL", ["production"])
        if env["key"] == "TEST_KEY":
            print("SUCCESS: set_env_var returned correct data")
        else:
            print(f"FAILED: set_env_var mismatch")

        # 5. Test Retry Logic (429)
        print("\n[5] Testing Retry Logic (429)...")
        # Sequence: 429 -> 429 -> 200
        mock_429 = AsyncMock(status_code=429, headers={"Retry-After": "1"})
        mock_200 = AsyncMock(status_code=200, json=lambda: {"success": True})
        
        mock_client.request.side_effect = [mock_429, mock_429, mock_200]
        
        # We need to mock asyncio.sleep to avoid waiting in test
        with patch('asyncio.sleep', new_callable=AsyncMock) as mock_sleep:
            res = await client.list_deployments("proj1")
            
            if mock_sleep.call_count == 2:
                print("SUCCESS: Retried 2 times on 429")
            else:
                print(f"FAILED: Expected 2 retries, got {mock_sleep.call_count}")

if __name__ == "__main__":
    asyncio.run(test_vercel_client())
