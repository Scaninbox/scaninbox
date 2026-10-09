"""Launch the one campaign explicitly authorized by the user."""
import json
import urllib.request
from pathlib import Path
from datetime import datetime, timedelta, timezone
import ads_research as auth
from google.ads.googleads.errors import GoogleAdsException

OUT=Path(__file__).parent/'reports/eng-launch-2026-10-09'
CID='24331063425'

def main():
    client=auth.ads_client();svc=client.get_service('GoogleAdsService')
    def query(q):return list(svc.search(customer_id=auth.CUSTOMER,query=q))
    row=query('SELECT campaign.resource_name, campaign.status, campaign.start_date_time, campaign.end_date_time, campaign.bidding_strategy_type, campaign.network_settings.target_google_search, campaign.network_settings.target_search_network, campaign.network_settings.target_content_network, campaign.ai_max_setting.enable_ai_max, campaign.geo_target_type_setting.positive_geo_target_type, campaign_budget.period, campaign_budget.total_amount_micros FROM campaign WHERE campaign.id = '+CID)[0]
    assert row.campaign_budget.period.name=='CUSTOM_PERIOD' and row.campaign_budget.total_amount_micros==25000000
    assert row.campaign.bidding_strategy_type.name=='MANUAL_CPC'
    assert row.campaign.network_settings.target_google_search and not row.campaign.network_settings.target_search_network and not row.campaign.network_settings.target_content_network
    assert not row.campaign.ai_max_setting.enable_ai_max
    assert row.campaign.geo_target_type_setting.positive_geo_target_type.name=='PRESENCE'
    keywords=query('SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.cpc_bid_micros, ad_group_criterion.approval_status FROM ad_group_criterion WHERE campaign.id = '+CID+' AND ad_group_criterion.type = KEYWORD AND ad_group_criterion.status != REMOVED')
    assert len(keywords)==154 and all(x.ad_group_criterion.cpc_bid_micros==100000 and x.ad_group_criterion.keyword.match_type.name=='EXACT' for x in keywords)
    ads=query('SELECT ad_group.name, ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status FROM ad_group_ad WHERE campaign.id = '+CID)
    assert len(ads)==3
    assert any(x.ad_group_ad.policy_summary.approval_status.name!='DISAPPROVED' for x in ads)
    conv=query('SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.type, conversion_action.primary_for_goal, conversion_action.tag_snippets FROM conversion_action WHERE conversion_action.status = ENABLED')
    assert any(x.conversion_action.primary_for_goal and 'ScanInbox' in x.conversion_action.name for x in conv)
    def fetch(url):
        with urllib.request.urlopen(url,timeout=30) as response:
            assert response.status==200
            return response.read().decode('utf-8')
    site=fetch('https://scaninbox.me/en/')
    assert 'GTM-W4W896PC' in site and 'event: "generate_lead"' in site and 'result === "created"' in site
    gtm=fetch('https://www.googletagmanager.com/gtm.js?id=GTM-W4W896PC')
    assert '18484946256' in gtm and 'ZboxCLn_tpQdENDKp-5E' in gtm and 'generate_lead' in gtm
    # Riga is UTC+3 on the authorized launch date, 9 October 2026.
    now=datetime.now(timezone(timedelta(hours=3)))
    assert now.date().isoformat()=='2026-10-09', 'Client date changed; recheck intended launch window.'
    next_month=now.replace(year=now.year+(now.month==12),month=now.month%12+1)
    end=(next_month.date()-timedelta(days=1)).isoformat()+' 23:59:59'
    op=client.get_type('CampaignOperation')
    op.update.resource_name=row.campaign.resource_name
    op.update.status=client.enums.CampaignStatusEnum.ENABLED
    op.update.end_date_time=end
    op.update_mask.paths.extend(['status','end_date_time'])
    req=client.get_type('MutateCampaignsRequest')
    req.customer_id=auth.CUSTOMER;req.operations.append(op);req.validate_only=True
    client.get_service('CampaignService').mutate_campaigns(request=req)
    req.validate_only=False
    client.get_service('CampaignService').mutate_campaigns(request=req)
    result=query('SELECT campaign.name, campaign.status, campaign.primary_status, campaign.primary_status_reasons, campaign.start_date_time, campaign.end_date_time, campaign_budget.total_amount_micros FROM campaign WHERE campaign.id = '+CID)[0]
    assert result.campaign.status.name=='ENABLED'
    summary={'campaign_id':CID,'status':result.campaign.status.name,'primary_status':result.campaign.primary_status.name,'reasons':[x.name for x in result.campaign.primary_status_reasons],'launched_at_riga':now.isoformat(),'end':result.campaign.end_date_time,'total_budget_eur':result.campaign_budget.total_amount_micros/1000000,'max_cpc_eur':.10,'conversion_check':'Enabled primary conversion and published GTM generate_lead mapping verified; no new test lead submitted.','ads':[{'group':x.ad_group.name,'approval':x.ad_group_ad.policy_summary.approval_status.name,'review':x.ad_group_ad.policy_summary.review_status.name} for x in ads]}
    (OUT/'Launch-Confirmation.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=True,indent=2))

if __name__=='__main__':
    try:main()
    except GoogleAdsException as ex:print('ADS_ERROR',[(str(x.error_code),x.message) for x in ex.failure.errors])
    except Exception as ex:print('LAUNCH_CHECK_FAILED',type(ex).__name__,str(ex) if isinstance(ex,AssertionError) else 'No secrets displayed.')
