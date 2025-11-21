#!/usr/bin/env python3
"""
Multi-Provider Model Names Discovery Script
===========================================

Tests model names across OpenAI, Anthropic (Claude), Mistral, and DeepSeek
to discover which ones are actually valid and available via their APIs.

Usage:
    python scripts/test-models.py [provider]
    
    provider: openai, claude, mistral, deepseek, or 'all' (default)

Requirements:
    pip install requests python-dotenv

API Keys:
    Set in .env file:
    - OPENAI_API_KEY
    - ANTHROPIC_API_KEY (Claude)
    - MISTRAL_API_KEY
    - DEEPSEEK_API_KEY
"""

import os
import sys
import json
import time
import requests
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path

# Add parent directory to path to load .env
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️  python-dotenv not installed. Using system environment variables.")


# ============================================================================
# MODEL CANDIDATES BY PROVIDER
# ============================================================================

OPENAI_MODELS = [
    # GPT-5 variants
    "gpt-5",
    "gpt-5-turbo",
    "gpt-5-preview",
    "gpt-5-2025-08-07",
    
    # GPT-4o variants (latest)
    "gpt-4o",
    "gpt-4o-latest",
    "gpt-4o-2024-11-20",
    "gpt-4o-2024-08-06",
    "gpt-4o-mini",
    "gpt-4o-mini-2024-07-18",
    "chatgpt-4o-latest",
    
    # o1 reasoning models
    "o1",
    "o1-preview",
    "o1-preview-2024-09-12",
    "o1-mini",
    "o1-mini-2024-09-12",
    
    # o3 (newest reasoning)
    "o3",
    "o3-mini",
    "o3-preview",
    
    # GPT-4 Turbo
    "gpt-4-turbo",
    "gpt-4-turbo-preview",
    "gpt-4-turbo-2024-04-09",
    
    # GPT-3.5
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-0125",
]

CLAUDE_MODELS = [
    # Claude 4.5 (Sonnet 4.5 - May 2025)
    "claude-sonnet-4-5-20250514",
    "claude-4-5-sonnet-20250514",
    "claude-sonnet-4.5-20250514",
    "claude-4.5-sonnet",
    
    # Claude 3.5 (current)
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-20241022",
    "claude-3-5-haiku-latest",
    
    # Claude 3
    "claude-3-opus-20240229",
    "claude-3-opus-latest",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
    
    # Legacy names
    "claude-3-5-sonnet",
    "claude-3-opus",
]

MISTRAL_MODELS = [
    # Latest models
    "mistral-large-latest",
    "mistral-large-2407",
    "mistral-medium-latest",
    "mistral-small-latest",
    "mistral-tiny",
    
    # Codestral
    "codestral-latest",
    "codestral-2405",
    
    # Open source
    "open-mistral-7b",
    "open-mixtral-8x7b",
    "open-mixtral-8x22b",
]

DEEPSEEK_MODELS = [
    # Chat models
    "deepseek-chat",
    "deepseek-coder",
    
    # R1 reasoning
    "deepseek-reasoner",
    "deepseek-r1",
    "deepseek-r1-distill-qwen-32b",
    "deepseek-r1-distill-llama-70b",
]


# ============================================================================
# PROVIDER CONFIGURATIONS
# ============================================================================

PROVIDERS = {
    "openai": {
        "name": "OpenAI",
        "api_key_env": "OPENAI_API_KEY",
        "endpoint": "https://api.openai.com/v1/chat/completions",
        "models": OPENAI_MODELS,
        "auth_header": lambda key: {"Authorization": f"Bearer {key}"},
        "request_body": lambda model: {
            "model": model,
            "messages": [{"role": "user", "content": "Say 'OK' if you can respond."}],
            "max_tokens": 10,
            "temperature": 0.0,
        },
    },
    "claude": {
        "name": "Anthropic (Claude)",
        "api_key_env": "CLAUDE_API_KEY",
        "endpoint": "https://api.anthropic.com/v1/messages",
        "models": CLAUDE_MODELS,
        "auth_header": lambda key: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
        "request_body": lambda model: {
            "model": model,
            "messages": [{"role": "user", "content": "Say 'OK' if you can respond."}],
            "max_tokens": 10,
        },
    },
    "mistral": {
        "name": "Mistral AI",
        "api_key_env": "MISTRAL_API_KEY",
        "endpoint": "https://api.mistral.ai/v1/chat/completions",
        "models": MISTRAL_MODELS,
        "auth_header": lambda key: {"Authorization": f"Bearer {key}"},
        "request_body": lambda model: {
            "model": model,
            "messages": [{"role": "user", "content": "Say 'OK' if you can respond."}],
            "max_tokens": 10,
        },
    },
    "deepseek": {
        "name": "DeepSeek",
        "api_key_env": "DEEPSEEK_API_KEY",
        "endpoint": "https://api.deepseek.com/v1/chat/completions",
        "models": DEEPSEEK_MODELS,
        "auth_header": lambda key: {"Authorization": f"Bearer {key}"},
        "request_body": lambda model: {
            "model": model,
            "messages": [{"role": "user", "content": "Say 'OK' if you can respond."}],
            "max_tokens": 10,
        },
    },
}


# ============================================================================
# TEST FUNCTIONS
# ============================================================================

def test_model(provider_name: str, model_name: str, timeout: int = 15) -> Dict:
    """Test if a model name is valid for a given provider."""
    provider = PROVIDERS[provider_name]
    
    result = {
        "provider": provider_name,
        "model": model_name,
        "valid": False,
        "status_code": None,
        "error": None,
        "response_preview": None,
        "model_returned": None,
    }
    
    # Get API key
    api_key = os.environ.get(provider["api_key_env"])
    if not api_key:
        result["error"] = f"API key not set ({provider['api_key_env']})"
        return result
    
    try:
        headers = {
            "Content-Type": "application/json",
            **provider["auth_header"](api_key),
        }
        
        # First attempt with default body
        response = requests.post(
            provider["endpoint"],
            headers=headers,
            json=provider["request_body"](model_name),
            timeout=timeout,
        )
        
        result["status_code"] = response.status_code
        
        # If error, retry with reasoning model params (for o1, o3, gpt-5)
        if response.status_code == 400 and provider_name == "openai":
            try:
                error_data = response.json()
                error_msg = error_data.get("error", {}).get("message", "")
                if "max_completion_tokens" in error_msg or "temperature" in error_msg:
                    # Retry with reasoning model format (no temperature, max_completion_tokens)
                    body = {
                        "model": model_name,
                        "messages": [{"role": "user", "content": "Say 'OK' if you can respond."}],
                        "max_completion_tokens": 100,
                    }
                    
                    response = requests.post(
                        provider["endpoint"],
                        headers=headers,
                        json=body,
                        timeout=timeout,
                    )
                    result["status_code"] = response.status_code
            except:
                pass
        
        result["status_code"] = response.status_code
        
        if response.status_code == 200:
            data = response.json()
            result["valid"] = True
            
            # Extract response based on provider
            if provider_name == "claude":
                result["response_preview"] = data.get("content", [{}])[0].get("text", "")[:50]
                result["model_returned"] = data.get("model")
            else:
                result["response_preview"] = data.get("choices", [{}])[0].get("message", {}).get("content", "")[:50]
                result["model_returned"] = data.get("model")
        
        elif response.status_code == 404:
            result["error"] = "Model not found (404)"
        
        elif response.status_code == 400:
            try:
                error_data = response.json()
                error_msg = error_data.get("error", {}).get("message", "Unknown error")
                result["error"] = f"Bad request: {error_msg}"
            except:
                result["error"] = "Bad request (400)"
        
        elif response.status_code == 401:
            result["error"] = "Authentication failed (401)"
        
        else:
            result["error"] = f"HTTP {response.status_code}"
    
    except requests.Timeout:
        result["error"] = "Request timeout"
    except requests.RequestException as e:
        result["error"] = f"Request error: {str(e)}"
    except Exception as e:
        result["error"] = f"Unexpected error: {str(e)}"
    
    return result


def test_provider(provider_name: str) -> Dict:
    """Test all models for a given provider."""
    provider = PROVIDERS[provider_name]
    
    print(f"\n{'=' * 80}")
    print(f"Testing {provider['name']}")
    print(f"{'=' * 80}")
    
    # Check API key
    api_key = os.environ.get(provider["api_key_env"])
    if not api_key:
        print(f"⚠️  Skipping: {provider['api_key_env']} not set in .env")
        return {"provider": provider_name, "skipped": True, "results": []}
    
    print(f"✅ API key found: {api_key[:10]}...{api_key[-4:]}")
    print(f"Testing {len(provider['models'])} model candidates...\n")
    
    results = []
    valid_models = []
    
    for i, model_name in enumerate(provider["models"], 1):
        print(f"[{i}/{len(provider['models'])}] {model_name:<45}", end=" ", flush=True)
        
        result = test_model(provider_name, model_name)
        results.append(result)
        
        if result["valid"]:
            print(f"✅ VALID")
            if result["model_returned"] and result["model_returned"] != model_name:
                print(f"    → API returned: {result['model_returned']}")
            valid_models.append(result)
        else:
            print(f"❌ {result['error']}")
        
        time.sleep(0.5)  # Rate limiting
    
    print(f"\n{'=' * 80}")
    print(f"✅ Valid: {len(valid_models)} | ❌ Invalid: {len(results) - len(valid_models)}")
    
    if valid_models:
        print(f"\n✅ VALID MODELS FOR {provider['name'].upper()}:")
        print("-" * 80)
        for r in valid_models:
            print(f"  • {r['model']}")
            if r['model_returned'] and r['model_returned'] != r['model']:
                print(f"    → API returned: {r['model_returned']}")
    
    return {
        "provider": provider_name,
        "skipped": False,
        "total": len(results),
        "valid": len(valid_models),
        "results": results,
        "valid_models": valid_models,
    }


def main():
    """Main discovery script."""
    print("=" * 80)
    print("Multi-Provider Model Names Discovery")
    print("=" * 80)
    print(f"Timestamp: {datetime.now().isoformat()}\n")
    
    # Determine which providers to test
    if len(sys.argv) > 1 and sys.argv[1] in PROVIDERS:
        providers_to_test = [sys.argv[1]]
    elif len(sys.argv) > 1 and sys.argv[1] == "all":
        providers_to_test = list(PROVIDERS.keys())
    else:
        providers_to_test = list(PROVIDERS.keys())
    
    print(f"Testing providers: {', '.join(providers_to_test)}\n")
    
    # Test each provider
    all_results = {}
    for provider_name in providers_to_test:
        all_results[provider_name] = test_provider(provider_name)
    
    # Save results
    os.makedirs("logs", exist_ok=True)
    output_file = f"logs/model_discovery_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    with open(output_file, 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "results": all_results,
        }, f, indent=2)
    
    print(f"\n📁 Full results saved to: {output_file}")
    
    # Summary
    print(f"\n{'=' * 80}")
    print("SUMMARY")
    print(f"{'=' * 80}")
    
    for provider_name, result in all_results.items():
        if result.get("skipped"):
            print(f"⚠️  {PROVIDERS[provider_name]['name']}: Skipped (no API key)")
        else:
            print(f"✅ {PROVIDERS[provider_name]['name']}: {result['valid']}/{result['total']} valid")
    
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
