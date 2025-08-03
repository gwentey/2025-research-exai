-- Insertion des templates de manifest par défaut
-- Généré automatiquement par create_default_manifest_templates.py

-- Template: education_kaggle_template
INSERT INTO manifest_templates (
    id, name, description, source_type, domain, template_data, is_active
) VALUES (
    gen_random_uuid(),
    'education_kaggle_template',
    'Template pour datasets éducatifs importés depuis Kaggle',
    'kaggle',
    'education',
    '{''version'': ''1.0'', ''dataset'': {''name'': '''', ''description'': '''', ''source'': {''type'': ''kaggle'', ''reference'': '''', ''url'': ''''}}, ''files'': [], ''technical'': {''instances'': 0, ''features'': 0, ''target_column'': '''', ''ml_tasks'': [''classification'', ''regression''], ''columns'': []}, ''ethical'': {''anonymization_applied'': True, ''anonymization_method'': ''Removal of direct student identifiers (names, IDs)'', ''informed_consent'': True, ''consent_details'': ''Educational data collected with institutional consent and student awareness'', ''transparency'': True, ''data_collection_method'': ''Academic records and surveys in educational institutions'', ''equity_non_discrimination'': True, ''bias_assessment'': ''Dataset reviewed for demographic representation and educational equity'', ''security_measures_in_place'': True, ''security_details'': ''Data encrypted in transit and at rest, access restricted to authorized personnel'', ''data_quality_documented'': True, ''quality_issues'': ''Minor missing values in optional survey responses'', ''accountability_defined'': True, ''data_owner'': ''Educational Institution Research Office'', ''contact'': ''research@university.edu'', ''ferpa_compliance'': True, ''parental_consent'': ''Required for students under 18'', ''educational_purpose'': ''Academic research and educational improvement''}, ''validation'': {''schema_version'': ''1.0'', ''validated_by'': ''template''}}',
    'active'
);

-- Template: healthcare_template
INSERT INTO manifest_templates (
    id, name, description, source_type, domain, template_data, is_active
) VALUES (
    gen_random_uuid(),
    'healthcare_template',
    'Template pour datasets de santé avec conformité HIPAA',
    'clinical_study',
    'healthcare',
    '{''version'': ''1.0'', ''dataset'': {''name'': '''', ''description'': '''', ''source'': {''type'': ''clinical_study'', ''reference'': '''', ''url'': ''''}}, ''files'': [], ''technical'': {''instances'': 0, ''features'': 0, ''target_column'': '''', ''ml_tasks'': [''classification'', ''regression'', ''survival_analysis''], ''columns'': []}, ''ethical'': {''anonymization_applied'': True, ''anonymization_method'': ''HIPAA-compliant de-identification with safe harbor method'', ''informed_consent'': True, ''consent_details'': ''Informed consent obtained from all participants with IRB approval'', ''transparency'': True, ''data_collection_method'': ''Clinical records and patient-reported outcomes'', ''equity_non_discrimination'': True, ''bias_assessment'': ''Patient population assessed for demographic and clinical diversity'', ''security_measures_in_place'': True, ''security_details'': ''HIPAA-compliant security measures, encrypted storage, audit trails'', ''data_quality_documented'': True, ''quality_issues'': ''Missing values documented, quality control procedures applied'', ''accountability_defined'': True, ''data_owner'': ''Clinical Research Institution'', ''contact'': ''irb@hospital.org'', ''hipaa_compliance'': True, ''irb_approval'': ''Required'', ''ethical_review_board_approval'': True, ''data_sensitivity'': ''high''}, ''validation'': {''schema_version'': ''1.0'', ''validated_by'': ''template''}}',
    'active'
);

-- Template: finance_template
INSERT INTO manifest_templates (
    id, name, description, source_type, domain, template_data, is_active
) VALUES (
    gen_random_uuid(),
    'finance_template',
    'Template pour datasets financiers avec conformité PCI-DSS',
    'financial_institution',
    'finance',
    '{''version'': ''1.0'', ''dataset'': {''name'': '''', ''description'': '''', ''source'': {''type'': ''financial_institution'', ''reference'': '''', ''url'': ''''}}, ''files'': [], ''technical'': {''instances'': 0, ''features'': 0, ''target_column'': '''', ''ml_tasks'': [''classification'', ''regression'', ''fraud_detection''], ''columns'': []}, ''ethical'': {''anonymization_applied'': True, ''anonymization_method'': ''PCI-DSS compliant tokenization and pseudonymization'', ''informed_consent'': True, ''consent_details'': ''Customer consent obtained per financial privacy regulations'', ''transparency'': True, ''data_collection_method'': ''Transaction records and customer applications'', ''equity_non_discrimination'': True, ''bias_assessment'': ''Model tested for discriminatory bias across protected groups'', ''security_measures_in_place'': True, ''security_details'': ''PCI-DSS Level 1 compliance, end-to-end encryption, HSM protection'', ''data_quality_documented'': True, ''quality_issues'': ''Data quality metrics and monitoring in place'', ''accountability_defined'': True, ''data_owner'': ''Financial Institution Data Office'', ''contact'': ''privacy@bank.com'', ''pci_compliance'': True, ''gdpr_compliance'': True, ''financial_regulation_compliance'': ''GDPR, PCI-DSS, SOX'', ''data_sensitivity'': ''high''}, ''validation'': {''schema_version'': ''1.0'', ''validated_by'': ''template''}}',
    'active'
);

-- Template: social_template
INSERT INTO manifest_templates (
    id, name, description, source_type, domain, template_data, is_active
) VALUES (
    gen_random_uuid(),
    'social_template',
    'Template pour datasets sociaux et comportementaux',
    'survey',
    'social',
    '{''version'': ''1.0'', ''dataset'': {''name'': '''', ''description'': '''', ''source'': {''type'': ''survey'', ''reference'': '''', ''url'': ''''}}, ''files'': [], ''technical'': {''instances'': 0, ''features'': 0, ''target_column'': '''', ''ml_tasks'': [''classification'', ''clustering'', ''sentiment_analysis''], ''columns'': []}, ''ethical'': {''anonymization_applied'': True, ''anonymization_method'': ''Removal of personal identifiers and demographic generalization'', ''informed_consent'': True, ''consent_details'': ''Voluntary participation with informed consent for research use'', ''transparency'': True, ''data_collection_method'': ''Online surveys and social media with user consent'', ''equity_non_discrimination'': True, ''bias_assessment'': ''Representative sampling across demographic groups'', ''security_measures_in_place'': True, ''security_details'': ''Secure data transmission and storage with access controls'', ''data_quality_documented'': True, ''quality_issues'': ''Response bias and missing data patterns documented'', ''accountability_defined'': True, ''data_owner'': ''Social Research Institute'', ''contact'': ''ethics@socialresearch.org'', ''psychological_harm_assessment'': True, ''vulnerable_population_protection'': True, ''data_sensitivity'': ''medium''}, ''validation'': {''schema_version'': ''1.0'', ''validated_by'': ''template''}}',
    'active'
);

