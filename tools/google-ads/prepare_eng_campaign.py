"""Prepare a paused English test; never enables or launches a campaign."""
import argparse
import json
from pathlib import Path
import ads_research as auth
from google.ads.googleads.errors import GoogleAdsException

ROOT = Path(__file__).parent
OUT = ROOT / 'reports' / 'eng-launch-2026-10-09'
NAME = 'ScanInbox | ENG | Ireland | Desktop | EUR25'

def build():
    client = auth.ads_client()
    E = client.enums
    ops = []
    def create(kind):
        op = client.get_type('MutateOperation')
        obj = getattr(op, kind + '_operation').create
        ops.append(op)
        return obj
    budget = create('campaign_budget')
    budget.resource_name = f'customers/{auth.CUSTOMER}/campaignBudgets/-1'
    budget.name = NAME
    budget.period = E.BudgetPeriodEnum.CUSTOM_PERIOD
    budget.total_amount_micros = 25000000
    budget.explicitly_shared = False
    budget.delivery_method = E.BudgetDeliveryMethodEnum.STANDARD
    campaign = create('campaign')
    campaign.resource_name = f'customers/{auth.CUSTOMER}/campaigns/-2'
    campaign.name = NAME
    campaign.status = E.CampaignStatusEnum.PAUSED
    campaign.advertising_channel_type = E.AdvertisingChannelTypeEnum.SEARCH
    campaign.campaign_budget = budget.resource_name
    campaign.manual_cpc.enhanced_cpc_enabled = False
    campaign.start_date_time = '2026-10-09 00:00:00'
    campaign.end_date_time = '2026-11-08 23:59:59'
    campaign.network_settings.target_google_search = True
    campaign.network_settings.target_search_network = False
    campaign.network_settings.target_content_network = False
    campaign.network_settings.target_partner_search_network = False
    campaign.geo_target_type_setting.positive_geo_target_type = E.PositiveGeoTargetTypeEnum.PRESENCE
    campaign.geo_target_type_setting.negative_geo_target_type = E.NegativeGeoTargetTypeEnum.PRESENCE
    campaign.ai_max_setting.enable_ai_max = False
    campaign.contains_eu_political_advertising = E.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
    loc = create('campaign_criterion')
    loc.campaign = campaign.resource_name
    loc.location.geo_target_constant = 'geoTargetConstants/2372'
    lang = create('campaign_criterion')
    lang.campaign = campaign.resource_name
    lang.language.language_constant = 'languageConstants/1000'
    # Search inventory does not support connected TV criteria.
    for device in ['MOBILE', 'TABLET']:
        crit = create('campaign_criterion')
        crit.campaign = campaign.resource_name
        crit.device.type_ = getattr(E.DeviceEnum, device)
        crit.bid_modifier = 0
    drafts = json.loads((ROOT/'data/English-Ad-Drafts.json').read_text(encoding='utf-8'))
    keys = json.loads((ROOT/'data/keywords.json').read_text(encoding='utf-8'))['requested_keywords']
    assert len(keys) == len(set(keys)) == 154
    assignments = {}
    def group_for(k):
        if any(x in k for x in ['365', 'oauth', 'office 365']): return 2
        if any(x in k for x in ['settings', 'set up', 'setup', 'configure', 'configuration', 'not working', 'failed', 'error', 'gmail', 'hotmail', 'outlook', 'yahoo', 'comcast']): return 1
        return 0
    for i, title in enumerate(['Printer SMTP', 'Scan-to-Email Setup', 'Microsoft 365 Alternative']):
        group = create('ad_group')
        group.resource_name = f'customers/{auth.CUSTOMER}/adGroups/{-10-i}'
        group.campaign = campaign.resource_name
        group.name = title
        group.status = E.AdGroupStatusEnum.ENABLED
        group.type_ = E.AdGroupTypeEnum.SEARCH_STANDARD
        group.cpc_bid_micros = 100000
        ad = create('ad_group_ad')
        ad.ad_group = group.resource_name
        ad.status = E.AdGroupAdStatusEnum.ENABLED
        draft = drafts[i]
        ad.ad.final_urls.append(draft['final_url'])
        ad.ad.responsive_search_ad.path1 = draft['path1']
        ad.ad.responsive_search_ad.path2 = draft['path2']
        for n,text in enumerate(draft['headlines']):
            asset = client.get_type('AdTextAsset')
            asset.text = text
            if n == 0: asset.pinned_field = E.ServedAssetFieldTypeEnum.HEADLINE_1
            ad.ad.responsive_search_ad.headlines.append(asset)
        for text in draft['descriptions']:
            asset = client.get_type('AdTextAsset'); asset.text = text
            ad.ad.responsive_search_ad.descriptions.append(asset)
        for keyword in keys:
            if group_for(keyword) != i: continue
            assignments[keyword] = title
            crit = create('ad_group_criterion')
            crit.ad_group = group.resource_name
            crit.status = E.AdGroupCriterionStatusEnum.ENABLED
            crit.keyword.text = keyword
            crit.keyword.match_type = E.KeywordMatchTypeEnum.EXACT
            crit.cpc_bid_micros = 100000
    OUT.mkdir(parents=True, exist_ok=True)
    plan = dict(campaign=NAME,customer_id=auth.CUSTOMER,status='PAUSED',country='Ireland',geo_id=2372,language='English',language_id=1000,network='GOOGLE_SEARCH',devices=['DESKTOP'],max_cpc_eur=0.10,total_budget_eur=25,budget_period='CUSTOM_PERIOD',start_date_time=campaign.start_date_time,end_date_time=campaign.end_date_time,date_note='Draft window: reset to one calendar month from the actual launch date before enabling.',keyword_count=154,match_type='EXACT',assignments=assignments,ads=drafts)
    (OUT/'Campaign-Plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
    return client, ops

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('action',choices=['validate','create']); args=parser.parse_args()
    client,ops=build()
    svc=client.get_service('GoogleAdsService')
    rows=list(svc.search(customer_id=auth.CUSTOMER,query="SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.status != REMOVED"))
    if rows:
        print('Existing campaigns found; no duplicate or mutation attempted.'); return
    request=client.get_type('MutateGoogleAdsRequest')
    request.customer_id=auth.CUSTOMER
    request.mutate_operations.extend(ops)
    request.partial_failure=False
    request.validate_only=True
    try:
        svc.mutate(request=request)
    except GoogleAdsException as exc:
        # Use Google's documented review process only for exemptible violations.
        reviews=[]
        for error in exc.failure.errors:
            detail=error.details.policy_violation_details
            if not detail.is_exemptible:
                raise
            idx=error.location.field_path_elements[0].index
            op=ops[idx].ad_group_criterion_operation
            op.exempt_policy_violation_keys.append(detail.key)
            reviews.append({'keyword':op.create.keyword.text,'policy':detail.key.policy_name})
        (OUT/'Keyword-Review-Requests.json').write_text(json.dumps(reviews,indent=2),encoding='utf-8')
        request.mutate_operations.clear()
        request.mutate_operations.extend(ops)
        svc.mutate(request=request)
        print('Validated with standard Google review requests:',len(reviews))
    print('All operations validated; no changes made.')
    if args.action=='create':
        request.validate_only=False
        result=svc.mutate(request=request)
        resources=[r.campaign_result.resource_name for r in result.mutate_operation_responses if r.campaign_result.resource_name]
        (OUT/'Created-Campaign.json').write_text(json.dumps({'campaign_resources':resources,'status':'PAUSED'},indent=2),encoding='utf-8')
        print('Created paused campaign:',resources)

if __name__=='__main__':
    try: main()
    except GoogleAdsException as exc:
        errors=[{'code':str(e.error_code),'message':e.message,'field_path':str(e.location)} for e in exc.failure.errors]
        OUT.mkdir(parents=True,exist_ok=True)
        (OUT/'API-Validation-Errors.json').write_text(json.dumps(errors,indent=2),encoding='utf-8')
        print(json.dumps(errors,indent=2))
    except Exception as exc:
        print('Preparation failed:',type(exc).__name__,str(exc) if isinstance(exc,(AttributeError,ValueError,AssertionError)) else 'No secrets displayed.')
