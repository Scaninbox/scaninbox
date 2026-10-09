"""Local ScanInbox Google Ads research. No campaign mutation methods."""
import argparse
import json
import logging
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SECRETS_DIR = Path(os.environ.get('SCANINBOX_ADS_SECRETS_DIR', str(ROOT / '.secrets')))
CLIENT_FILE = SECRETS_DIR / 'google-ads-desktop-client.json'
TOKEN_FILE = SECRETS_DIR / 'google-ads-user-token.json'
SCOPE = 'https://www.googleapis.com/auth/adwords'
CUSTOMER = os.environ.get('SCANINBOX_ADS_CUSTOMER', '8211954796').replace('-', '')
if not CUSTOMER.isdigit() or len(CUSTOMER) != 10:
    raise ValueError('SCANINBOX_ADS_CUSTOMER must be a ten-digit account ID.')
PROJECT = os.environ.get('SCANINBOX_ADS_PROJECT', 'psyched-oxide-510920-r9')
logging.disable(logging.CRITICAL)  # OAuth errors must not print credentials.


def client_info():
    info = json.loads(CLIENT_FILE.read_text(encoding='utf-8-sig'))['installed']
    if info['project_id'] != PROJECT:
        raise ValueError('Unexpected Google Cloud project in local credentials.')
    return info


def authorize():
    from google_auth_oauthlib.flow import InstalledAppFlow
    client_info()
    if TOKEN_FILE.exists():
        raise ValueError('Authorization already saved. Use status or account first.')
    flow = InstalledAppFlow.from_client_secrets_file(
        str(CLIENT_FILE), scopes=[SCOPE], autogenerate_code_verifier=True)
    credentials = flow.run_local_server(
        host='127.0.0.1', port=8765, open_browser=False,
        authorization_prompt_message='Open in your regular browser:\n{url}',
        success_message='ScanInbox authorization saved locally. You may close this tab.',
        timeout_seconds=900, access_type='offline', prompt='consent select_account')
    if not credentials.refresh_token:
        raise ValueError('Google did not provide an offline refresh token.')
    SECRETS_DIR.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(credentials.to_json(), encoding='utf-8')
    print('Authorization saved locally. No credential values are displayed.')


def ads_client():
    from google.ads.googleads.client import GoogleAdsClient
    info = client_info()
    token = json.loads(TOKEN_FILE.read_text(encoding='utf-8'))
    if token['client_id'] != info['client_id']:
        raise ValueError('Token belongs to a different OAuth client.')
    return GoogleAdsClient.load_from_dict({
        'client_id': info['client_id'], 'client_secret': info['client_secret'],
        'refresh_token': token['refresh_token'], 'use_proto_plus': True,
    })


def account():
    client = ads_client()
    query = ('SELECT customer.id, customer.descriptive_name, customer.currency_code, '
             'customer.time_zone FROM customer LIMIT 1')
    rows = client.get_service('GoogleAdsService').search(customer_id=CUSTOMER, query=query)
    return [{'id': str(r.customer.id), 'name': r.customer.descriptive_name,
             'currency': r.customer.currency_code, 'timezone': r.customer.time_zone}
            for r in rows]


def locations(args):
    client = ads_client()
    request = client.get_type('SuggestGeoTargetConstantsRequest')
    request.locale = 'en'
    request.country_code = args.country.upper()
    request.location_names.names.append(args.location)
    result = client.get_service('GeoTargetConstantService').suggest_geo_target_constants(request=request)
    return [{'name': x.geo_target_constant.name,
             'canonical_name': x.geo_target_constant.canonical_name,
             'resource': x.geo_target_constant.resource_name,
             'country_code': x.geo_target_constant.country_code,
             'target_type': x.geo_target_constant.target_type}
            for x in result.geo_target_constant_suggestions]


def languages():
    client = ads_client()
    rows = client.get_service('GoogleAdsService').search(customer_id=CUSTOMER, query=(
        'SELECT language_constant.id, language_constant.code, language_constant.name '
        'FROM language_constant'))
    return [{'id': str(r.language_constant.id), 'code': r.language_constant.code,
             'name': r.language_constant.name} for r in rows]


def ideas(args):
    client = ads_client()
    request = client.get_type('GenerateKeywordIdeasRequest')
    request.customer_id = CUSTOMER
    request.language = f'languageConstants/{args.language_id}'
    request.geo_target_constants.append(f'geoTargetConstants/{args.geo_id}')
    request.keyword_plan_network = client.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH
    request.include_adult_keywords = False
    request.keyword_seed.keywords.extend(args.keyword)
    rows = client.get_service('KeywordPlanIdeaService').generate_keyword_ideas(request=request)
    result = []
    for row in rows:
        m = row.keyword_idea_metrics
        result.append({'keyword': row.text, 'avg_monthly_searches': m.avg_monthly_searches,
                       'competition': m.competition.name,
                       'competition_index': m.competition_index,
                       'low_top_of_page_bid_micros': m.low_top_of_page_bid_micros,
                       'high_top_of_page_bid_micros': m.high_top_of_page_bid_micros})
        if len(result) >= args.limit:
            break
    return {'customer': CUSTOMER, 'language_id': args.language_id, 'geo_id': args.geo_id,
            'network': 'GOOGLE_SEARCH', 'note': 'Historical estimates, not a price guarantee. Bid units are account currency micros.',
            'ideas': result}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    for name in ['authorize', 'status', 'account', 'languages']:
        commands.add_parser(name)
    geo = commands.add_parser('locations')
    geo.add_argument('--country', required=True)
    geo.add_argument('--location', required=True)
    keyword = commands.add_parser('ideas')
    keyword.add_argument('--language-id', type=int, required=True)
    keyword.add_argument('--geo-id', type=int, required=True)
    keyword.add_argument('--keyword', action='append', required=True)
    keyword.add_argument('--limit', type=int, default=30, choices=range(1, 101), metavar='1..100')
    args = parser.parse_args()
    if args.command == 'authorize':
        authorize()
        return
    if args.command == 'status':
        client_info()
        result = {'client_configured': True, 'oauth_authorized': TOKEN_FILE.exists(),
                  'customer': CUSTOMER, 'mode': 'research_only_no_campaign_mutations'}
    elif args.command == 'account':
        result = account()
    elif args.command == 'languages':
        result = languages()
    elif args.command == 'locations':
        result = locations(args)
    else:
        result = ideas(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # Do not print exception text or a traceback: OAuth/network failures may
        # contain tokens, authorization codes or request headers.
        from google.ads.googleads.errors import GoogleAdsException
        if isinstance(exc, GoogleAdsException):
            print(json.dumps({'error': 'GoogleAdsException', 'request_id': exc.request_id,
                              'codes': [str(e.error_code) for e in exc.failure.errors]}), file=sys.stderr)
        else:
            print(f'Operation failed ({type(exc).__name__}). No secrets displayed.', file=sys.stderr)
        sys.exit(1)
