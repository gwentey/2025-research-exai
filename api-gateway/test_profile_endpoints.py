#!/usr/bin/env python3
"""
Script de test pour vérifier les endpoints de profil utilisateur
"""
import httpx
import asyncio
import json
import sys

# Configuration
BASE_URL = "http://localhost:9000"

async def test_profile_endpoints():
    """Test des endpoints de profil avec authentification"""
    
    async with httpx.AsyncClient() as client:
        print("🔍 Test des endpoints de profil utilisateur")
        print("=" * 50)
        
        try:
            # Étape 1: Tester l'endpoint de santé
            print("\n1. Test endpoint santé...")
            health_response = await client.get(f"{BASE_URL}/health")
            print(f"✅ Health check: {health_response.status_code}")
            
            # Étape 2: Tenter de se connecter (nous devons d'abord avoir un token valide)
            print("\n2. Tentative de récupération du profil sans authentification...")
            me_response = await client.get(f"{BASE_URL}/users/me")
            print(f"❌ GET /users/me sans auth: {me_response.status_code} (attendu: 401)")
            
            # Afficher les endpoints disponibles
            print("\n3. Récupération des endpoints disponibles...")
            openapi_response = await client.get(f"{BASE_URL}/api/v1/openapi.json")
            if openapi_response.status_code == 200:
                openapi_data = openapi_response.json()
                paths = openapi_data.get("paths", {})
                user_endpoints = {path: methods for path, methods in paths.items() if "/users/" in path}
                print("📋 Endpoints utilisateur disponibles:")
                for path, methods in user_endpoints.items():
                    print(f"   {path}: {list(methods.keys())}")
                
                # Vérifier spécifiquement nos nouveaux endpoints
                profile_endpoints = ["/users/me", "/users/me/password", "/users/me/picture"]
                print("\n🔍 Vérification des endpoints de profil:")
                for endpoint in profile_endpoints:
                    if endpoint in paths:
                        available_methods = list(paths[endpoint].keys())
                        print(f"   ✅ {endpoint}: {available_methods}")
                    else:
                        print(f"   ❌ {endpoint}: Non trouvé")
            else:
                print(f"❌ Impossible de récupérer les endpoints: {openapi_response.status_code}")
            
            print("\n" + "=" * 50)
            print("✅ Test terminé. Pour tester avec authentification, utilisez un token JWT valide.")
            print("💡 Copiez votre token depuis la console du navigateur et relancez avec le token.")
            
        except Exception as e:
            print(f"❌ Erreur lors des tests: {str(e)}")
            return False
    
    return True

async def test_with_token(token: str):
    """Test avec un token d'authentification"""
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        print("🔐 Test avec authentification")
        print("=" * 50)
        
        try:
            # Test GET /users/me
            print("\n1. Test GET /users/me...")
            me_response = await client.get(f"{BASE_URL}/users/me", headers=headers)
            print(f"Status: {me_response.status_code}")
            if me_response.status_code == 200:
                user_data = me_response.json()
                print(f"✅ Utilisateur: {user_data.get('email', 'N/A')} (ID: {user_data.get('id', 'N/A')})")
            else:
                print(f"❌ Erreur: {me_response.text}")
                return False
            
            # Test DEBUG endpoint
            print("\n1.1. Test endpoint debug...")
            debug_response = await client.get(f"{BASE_URL}/users/me/debug", headers=headers)
            print(f"Debug Status: {debug_response.status_code}")
            if debug_response.status_code == 200:
                debug_data = debug_response.json()
                print(f"🔍 Debug: {debug_data}")
            else:
                print(f"❌ Debug erreur: {debug_response.text}")
            
            # Test PATCH /users/me
            print("\n2. Test PATCH /users/me...")
            profile_data = {
                "pseudo": "test_pseudo_" + str(asyncio.get_event_loop().time())[-4:],
                "given_name": "TestName",
                "family_name": "TestFamily",
                "locale": "fr"
            }
            
            patch_response = await client.patch(
                f"{BASE_URL}/users/me", 
                headers=headers,
                json=profile_data
            )
            print(f"Status: {patch_response.status_code}")
            if patch_response.status_code == 200:
                updated_user = patch_response.json()
                print(f"✅ Profil mis à jour: pseudo = {updated_user.get('pseudo', 'N/A')}")
            else:
                print(f"❌ Erreur mise à jour profil: {patch_response.text}")
                print(f"Request data: {profile_data}")
            
        except Exception as e:
            print(f"❌ Erreur lors des tests authentifiés: {str(e)}")
            return False
    
    return True

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Mode avec token
        token = sys.argv[1]
        print(f"🔑 Test avec token fourni: {token[:20]}...")
        asyncio.run(test_with_token(token))
    else:
        # Mode de base sans authentification
        asyncio.run(test_profile_endpoints())
        print("\n💡 Pour tester avec authentification:")
        print("   python test_profile_endpoints.py YOUR_JWT_TOKEN") 