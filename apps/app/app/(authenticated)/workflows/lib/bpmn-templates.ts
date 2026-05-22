export type BpmnTemplate = {
  id: string;
  label: string;
  description: string;
  category: "safe" | "scrum" | "blank";
  xml: string;
};

const FEATURE_FLOW_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="SAFe_Feature_Definitions" targetNamespace="http://cosmos.nebuloz/safe-feature">

  <bpmn:collaboration id="Collab_Feature">
    <bpmn:participant id="Pool_Team" name="Time SAFe" processRef="Proc_Team"/>
  </bpmn:collaboration>

  <bpmn:process id="Proc_Team" isExecutable="true">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_PO" name="Product Owner">
        <bpmn:flowNodeRef>Start_Feature</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Refinement</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Acceptance</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_Feature</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Team" name="Time de Desenvolvimento">
        <bpmn:flowNodeRef>Task_Planning</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Dev</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Test</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gw_Quality</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_SM" name="Scrum Master">
        <bpmn:flowNodeRef>Task_Impediment</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>

    <bpmn:startEvent id="Start_Feature" name="Feature&#10;Comprometida"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_Refinement" name="Refinamento&#10;de Backlog"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_Planning" name="Sprint Planning"><bpmn:incoming>F2</bpmn:incoming><bpmn:outgoing>F3</bpmn:outgoing></bpmn:userTask>
    <bpmn:task id="Task_Dev" name="Desenvolvimento"><bpmn:incoming>F3</bpmn:incoming><bpmn:outgoing>F4</bpmn:outgoing></bpmn:task>
    <bpmn:task id="Task_Impediment" name="Remover&#10;Impedimento"><bpmn:incoming>F_Imp</bpmn:incoming><bpmn:outgoing>F_ImpBack</bpmn:outgoing></bpmn:task>
    <bpmn:task id="Task_Test" name="Teste e&#10;Integração"><bpmn:incoming>F4</bpmn:incoming><bpmn:incoming>F_ImpBack</bpmn:incoming><bpmn:outgoing>F5</bpmn:outgoing></bpmn:task>
    <bpmn:exclusiveGateway id="Gw_Quality" name="Qualidade OK?"><bpmn:incoming>F5</bpmn:incoming><bpmn:outgoing>F6</bpmn:outgoing><bpmn:outgoing>F_Imp</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:userTask id="Task_Acceptance" name="Aceite do PO"><bpmn:incoming>F6</bpmn:incoming><bpmn:outgoing>F7</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="End_Feature" name="Feature&#10;Entregue"><bpmn:incoming>F7</bpmn:incoming></bpmn:endEvent>

    <bpmn:sequenceFlow id="F1" sourceRef="Start_Feature" targetRef="Task_Refinement"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Task_Refinement" targetRef="Task_Planning"/>
    <bpmn:sequenceFlow id="F3" sourceRef="Task_Planning" targetRef="Task_Dev"/>
    <bpmn:sequenceFlow id="F4" sourceRef="Task_Dev" targetRef="Task_Test"/>
    <bpmn:sequenceFlow id="F5" sourceRef="Task_Test" targetRef="Gw_Quality"/>
    <bpmn:sequenceFlow id="F6" name="Sim" sourceRef="Gw_Quality" targetRef="Task_Acceptance"/>
    <bpmn:sequenceFlow id="F_Imp" name="Não" sourceRef="Gw_Quality" targetRef="Task_Impediment"/>
    <bpmn:sequenceFlow id="F_ImpBack" sourceRef="Task_Impediment" targetRef="Task_Test"/>
    <bpmn:sequenceFlow id="F7" sourceRef="Task_Acceptance" targetRef="End_Feature"/>
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collab_Feature">
      <bpmndi:BPMNShape id="Pool_Team_di" bpmnElement="Pool_Team" isHorizontal="true"><dc:Bounds x="100" y="80" width="900" height="380"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_PO_di" bpmnElement="Lane_PO" isHorizontal="true"><dc:Bounds x="130" y="80" width="870" height="120"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Team_di" bpmnElement="Lane_Team" isHorizontal="true"><dc:Bounds x="130" y="200" width="870" height="160"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_SM_di" bpmnElement="Lane_SM" isHorizontal="true"><dc:Bounds x="130" y="360" width="870" height="100"/></bpmndi:BPMNShape>

      <bpmndi:BPMNShape id="Start_Feature_di" bpmnElement="Start_Feature"><dc:Bounds x="172" y="122" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="157" y="165" width="67" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Refinement_di" bpmnElement="Task_Refinement"><dc:Bounds x="260" y="100" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Planning_di" bpmnElement="Task_Planning"><dc:Bounds x="420" y="220" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Dev_di" bpmnElement="Task_Dev"><dc:Bounds x="570" y="220" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Test_di" bpmnElement="Task_Test"><dc:Bounds x="720" y="220" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gw_Quality_di" bpmnElement="Gw_Quality" isMarkerVisible="true"><dc:Bounds x="855" y="235" width="50" height="50"/><bpmndi:BPMNLabel><dc:Bounds x="842" y="292" width="77" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Acceptance_di" bpmnElement="Task_Acceptance"><dc:Bounds x="720" y="100" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Feature_di" bpmnElement="End_Feature"><dc:Bounds x="862" y="122" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="849" y="165" width="63" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Impediment_di" bpmnElement="Task_Impediment"><dc:Bounds x="720" y="370" width="100" height="80"/></bpmndi:BPMNShape>

      <bpmndi:BPMNEdge id="F1_di" bpmnElement="F1"><di:waypoint x="208" y="140"/><di:waypoint x="260" y="140"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F2_di" bpmnElement="F2"><di:waypoint x="310" y="180"/><di:waypoint x="470" y="220"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F3_di" bpmnElement="F3"><di:waypoint x="520" y="260"/><di:waypoint x="570" y="260"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F4_di" bpmnElement="F4"><di:waypoint x="670" y="260"/><di:waypoint x="720" y="260"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F5_di" bpmnElement="F5"><di:waypoint x="820" y="260"/><di:waypoint x="855" y="260"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F6_di" bpmnElement="F6"><di:waypoint x="880" y="235"/><di:waypoint x="880" y="140"/><di:waypoint x="820" y="140"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F_Imp_di" bpmnElement="F_Imp"><di:waypoint x="880" y="285"/><di:waypoint x="880" y="410"/><di:waypoint x="820" y="410"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F_ImpBack_di" bpmnElement="F_ImpBack"><di:waypoint x="720" y="410"/><di:waypoint x="770" y="410"/><di:waypoint x="770" y="300"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F7_di" bpmnElement="F7"><di:waypoint x="820" y="140"/><di:waypoint x="862" y="140"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const SPRINT_CEREMONY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Sprint_Ceremony_Definitions" targetNamespace="http://cosmos.nebuloz/sprint-ceremony">

  <bpmn:process id="Proc_Sprint" isExecutable="true">
    <bpmn:startEvent id="Start_Sprint" name="Início do Sprint"><bpmn:outgoing>S1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_Planning" name="Sprint Planning&#10;(4h)"><bpmn:incoming>S1</bpmn:incoming><bpmn:outgoing>S2</bpmn:outgoing></bpmn:userTask>
    <bpmn:subProcess id="Sub_Sprint" name="Sprint (2 semanas)"><bpmn:incoming>S2</bpmn:incoming><bpmn:outgoing>S3</bpmn:outgoing>
      <bpmn:startEvent id="SubStart"><bpmn:outgoing>SS1</bpmn:outgoing></bpmn:startEvent>
      <bpmn:task id="Sub_Daily" name="Daily Standup&#10;(15 min)"><bpmn:incoming>SS1</bpmn:incoming><bpmn:outgoing>SS2</bpmn:outgoing></bpmn:task>
      <bpmn:task id="Sub_Dev" name="Desenvolvimento&#10;e Teste"><bpmn:incoming>SS2</bpmn:incoming><bpmn:outgoing>SS3</bpmn:outgoing></bpmn:task>
      <bpmn:endEvent id="SubEnd"><bpmn:incoming>SS3</bpmn:incoming></bpmn:endEvent>
      <bpmn:sequenceFlow id="SS1" sourceRef="SubStart" targetRef="Sub_Daily"/>
      <bpmn:sequenceFlow id="SS2" sourceRef="Sub_Daily" targetRef="Sub_Dev"/>
      <bpmn:sequenceFlow id="SS3" sourceRef="Sub_Dev" targetRef="SubEnd"/>
    </bpmn:subProcess>
    <bpmn:userTask id="Task_Review" name="Sprint Review&#10;(2h)"><bpmn:incoming>S3</bpmn:incoming><bpmn:outgoing>S4</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_Retro" name="Retrospectiva&#10;(1.5h)"><bpmn:incoming>S4</bpmn:incoming><bpmn:outgoing>S5</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="End_Sprint" name="Fim do Sprint"><bpmn:incoming>S5</bpmn:incoming></bpmn:endEvent>

    <bpmn:sequenceFlow id="S1" sourceRef="Start_Sprint" targetRef="Task_Planning"/>
    <bpmn:sequenceFlow id="S2" sourceRef="Task_Planning" targetRef="Sub_Sprint"/>
    <bpmn:sequenceFlow id="S3" sourceRef="Sub_Sprint" targetRef="Task_Review"/>
    <bpmn:sequenceFlow id="S4" sourceRef="Task_Review" targetRef="Task_Retro"/>
    <bpmn:sequenceFlow id="S5" sourceRef="Task_Retro" targetRef="End_Sprint"/>
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Proc_Sprint">
      <bpmndi:BPMNShape id="Start_Sprint_di" bpmnElement="Start_Sprint"><dc:Bounds x="152" y="202" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="133" y="245" width="74" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Planning_di" bpmnElement="Task_Planning"><dc:Bounds x="240" y="180" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_Sprint_di" bpmnElement="Sub_Sprint" isExpanded="true"><dc:Bounds x="390" y="120" width="220" height="200"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SubStart_di" bpmnElement="SubStart"><dc:Bounds x="412" y="202" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_Daily_di" bpmnElement="Sub_Daily"><dc:Bounds x="460" y="180" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_Dev_di" bpmnElement="Sub_Dev"><dc:Bounds x="460" y="180" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SubEnd_di" bpmnElement="SubEnd"><dc:Bounds x="562" y="202" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Review_di" bpmnElement="Task_Review"><dc:Bounds x="660" y="180" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Retro_di" bpmnElement="Task_Retro"><dc:Bounds x="810" y="180" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Sprint_di" bpmnElement="End_Sprint"><dc:Bounds x="962" y="202" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="947" y="245" width="67" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>

      <bpmndi:BPMNEdge id="S1_di" bpmnElement="S1"><di:waypoint x="188" y="220"/><di:waypoint x="240" y="220"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="S2_di" bpmnElement="S2"><di:waypoint x="340" y="220"/><di:waypoint x="390" y="220"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="SS1_di" bpmnElement="SS1"><di:waypoint x="448" y="220"/><di:waypoint x="460" y="220"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="SS2_di" bpmnElement="SS2"><di:waypoint x="510" y="220"/><di:waypoint x="510" y="220"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="SS3_di" bpmnElement="SS3"><di:waypoint x="560" y="220"/><di:waypoint x="562" y="220"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="S3_di" bpmnElement="S3"><di:waypoint x="610" y="220"/><di:waypoint x="660" y="220"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="S4_di" bpmnElement="S4"><di:waypoint x="760" y="220"/><di:waypoint x="810" y="220"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="S5_di" bpmnElement="S5"><di:waypoint x="910" y="220"/><di:waypoint x="962" y="220"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const EPIC_APPROVAL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Epic_Approval_Definitions" targetNamespace="http://cosmos.nebuloz/epic-approval">

  <bpmn:process id="Proc_Epic" isExecutable="true">
    <bpmn:startEvent id="Start_Epic" name="Épico&#10;Proposto"><bpmn:outgoing>E1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_BusinessCase" name="Elaborar&#10;Business Case"><bpmn:incoming>E1</bpmn:incoming><bpmn:outgoing>E2</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_LPM" name="Revisão LPM&#10;(Lean Portfolio)"><bpmn:incoming>E2</bpmn:incoming><bpmn:outgoing>E3</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="Gw_LPM" name="LPM aprova?"><bpmn:incoming>E3</bpmn:incoming><bpmn:outgoing>E4</bpmn:outgoing><bpmn:outgoing>E_Reject1</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:userTask id="Task_Finance" name="Aprovação&#10;Financeira"><bpmn:incoming>E4</bpmn:incoming><bpmn:outgoing>E5</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="Gw_Finance" name="Finance aprova?"><bpmn:incoming>E5</bpmn:incoming><bpmn:outgoing>E6</bpmn:outgoing><bpmn:outgoing>E_Reject2</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:task id="Task_Commit" name="Comprometer&#10;no PI Planning"><bpmn:incoming>E6</bpmn:incoming><bpmn:outgoing>E7</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="End_Approved" name="Épico&#10;Aprovado"><bpmn:incoming>E7</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="End_Rejected1" name="Épico&#10;Rejeitado"><bpmn:incoming>E_Reject1</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="End_Rejected2" name="Épico&#10;Rejeitado"><bpmn:incoming>E_Reject2</bpmn:incoming></bpmn:endEvent>

    <bpmn:sequenceFlow id="E1" sourceRef="Start_Epic" targetRef="Task_BusinessCase"/>
    <bpmn:sequenceFlow id="E2" sourceRef="Task_BusinessCase" targetRef="Task_LPM"/>
    <bpmn:sequenceFlow id="E3" sourceRef="Task_LPM" targetRef="Gw_LPM"/>
    <bpmn:sequenceFlow id="E4" name="Sim" sourceRef="Gw_LPM" targetRef="Task_Finance"/>
    <bpmn:sequenceFlow id="E_Reject1" name="Não" sourceRef="Gw_LPM" targetRef="End_Rejected1"/>
    <bpmn:sequenceFlow id="E5" sourceRef="Task_Finance" targetRef="Gw_Finance"/>
    <bpmn:sequenceFlow id="E6" name="Sim" sourceRef="Gw_Finance" targetRef="Task_Commit"/>
    <bpmn:sequenceFlow id="E_Reject2" name="Não" sourceRef="Gw_Finance" targetRef="End_Rejected2"/>
    <bpmn:sequenceFlow id="E7" sourceRef="Task_Commit" targetRef="End_Approved"/>
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Proc_Epic">
      <bpmndi:BPMNShape id="Start_Epic_di" bpmnElement="Start_Epic"><dc:Bounds x="152" y="242" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="141" y="285" width="58" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_BusinessCase_di" bpmnElement="Task_BusinessCase"><dc:Bounds x="240" y="220" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_LPM_di" bpmnElement="Task_LPM"><dc:Bounds x="400" y="220" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gw_LPM_di" bpmnElement="Gw_LPM" isMarkerVisible="true"><dc:Bounds x="555" y="235" width="50" height="50"/><bpmndi:BPMNLabel><dc:Bounds x="543" y="292" width="75" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Finance_di" bpmnElement="Task_Finance"><dc:Bounds x="660" y="220" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gw_Finance_di" bpmnElement="Gw_Finance" isMarkerVisible="true"><dc:Bounds x="815" y="235" width="50" height="50"/><bpmndi:BPMNLabel><dc:Bounds x="795" y="292" width="91" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Commit_di" bpmnElement="Task_Commit"><dc:Bounds x="920" y="220" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Approved_di" bpmnElement="End_Approved"><dc:Bounds x="1082" y="242" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="1069" y="285" width="62" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Rejected1_di" bpmnElement="End_Rejected1"><dc:Bounds x="572" y="102" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="559" y="145" width="62" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Rejected2_di" bpmnElement="End_Rejected2"><dc:Bounds x="832" y="102" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="819" y="145" width="62" height="27"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>

      <bpmndi:BPMNEdge id="E1_di" bpmnElement="E1"><di:waypoint x="188" y="260"/><di:waypoint x="240" y="260"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="E2_di" bpmnElement="E2"><di:waypoint x="340" y="260"/><di:waypoint x="400" y="260"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="E3_di" bpmnElement="E3"><di:waypoint x="500" y="260"/><di:waypoint x="555" y="260"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="E4_di" bpmnElement="E4"><di:waypoint x="605" y="260"/><di:waypoint x="660" y="260"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="E_Reject1_di" bpmnElement="E_Reject1"><di:waypoint x="580" y="235"/><di:waypoint x="580" y="138"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="E5_di" bpmnElement="E5"><di:waypoint x="760" y="260"/><di:waypoint x="815" y="260"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="E6_di" bpmnElement="E6"><di:waypoint x="865" y="260"/><di:waypoint x="920" y="260"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="E_Reject2_di" bpmnElement="E_Reject2"><di:waypoint x="840" y="235"/><di:waypoint x="840" y="138"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="E7_di" bpmnElement="E7"><di:waypoint x="1020" y="260"/><di:waypoint x="1082" y="260"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const BLANK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Blank_Definitions" targetNamespace="http://cosmos.nebuloz/blank">
  <bpmn:process id="Process_blank" isExecutable="true">
    <bpmn:startEvent id="StartEvent_blank" name="Início"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_blank">
    <bpmndi:BPMNPlane id="BPMNPlane_blank" bpmnElement="Process_blank">
      <bpmndi:BPMNShape id="StartEvent_blank_di" bpmnElement="StartEvent_blank">
        <dc:Bounds x="412" y="252" width="36" height="36"/>
        <bpmndi:BPMNLabel><dc:Bounds x="405" y="295" width="51" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export const BPMN_TEMPLATES: BpmnTemplate[] = [
  {
    id: "safe-feature-flow",
    label: "Feature Implementation Flow",
    description: "SAFe 6.0 — PO, Time e SM com gates de qualidade",
    category: "safe",
    xml: FEATURE_FLOW_XML,
  },
  {
    id: "sprint-ceremony",
    label: "Sprint Ceremony",
    description: "Planning → Daily → Review → Retrospectiva",
    category: "scrum",
    xml: SPRINT_CEREMONY_XML,
  },
  {
    id: "epic-approval",
    label: "Epic Approval Flow",
    description: "Business Case → LPM → Finance → PI Commit",
    category: "safe",
    xml: EPIC_APPROVAL_XML,
  },
  {
    id: "blank",
    label: "Em Branco",
    description: "Diagrama vazio com evento de início",
    category: "blank",
    xml: BLANK_XML,
  },
];
