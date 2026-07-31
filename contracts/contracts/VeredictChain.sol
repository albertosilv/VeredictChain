// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VeredictChain
/// @notice Registro imutável de hashes de decisões judiciais, com ciclo de vida
///         (Publicada -> Retificada -> Arquivada) e credenciamento de magistrados.
/// @dev Não armazena o texto da decisão, apenas seu hash (SHA-256) e metadados públicos.
contract VeredictChain {
    enum Status { Inexistente, Publicada, Retificada, Arquivada }

    struct Decisao {
        bytes32 documentHash;      // hash SHA-256 do documento assinado
        string numeroProcesso;
        string tribunalOrigem;
        string orgaoJulgador;
        bytes32 magistradoHash;    // hash do certificado ICP-Brasil do magistrado
        string canalTransmissao;   // "DJe" | "SEEU" | "Malote Digital" | outro
        uint256 timestamp;
        Status status;
        bytes32 hashAnterior;      // 0x0 se for registro original
        address registradoPor;     // endereço do integrador que submeteu o registro
    }

    address public admin;

    // magistradoHash => credenciado
    mapping(bytes32 => bool) public magistradosCredenciados;

    // endereço do módulo de integração (ex: sistema de publicação do tribunal) => autorizado
    mapping(address => bool) public integradoresAutorizados;

    // documentHash => Decisao
    mapping(bytes32 => Decisao) private decisoes;

    // numeroProcesso => lista de hashes registrados, em ordem cronológica (histórico completo)
    mapping(string => bytes32[]) private historicoPorProcesso;

    event MagistradoCredenciado(bytes32 indexed magistradoHash);
    event MagistradoRevogado(bytes32 indexed magistradoHash);
    event IntegradorAutorizado(address indexed integrador);
    event IntegradorRevogado(address indexed integrador);

    event DecisaoRegistrada(
        bytes32 indexed documentHash,
        string numeroProcesso,
        bytes32 indexed magistradoHash,
        string canalTransmissao,
        uint256 timestamp
    );

    event DecisaoRetificada(
        bytes32 indexed novoHash,
        bytes32 indexed hashAnterior,
        string numeroProcesso,
        uint256 timestamp
    );

    event DecisaoArquivada(bytes32 indexed documentHash, uint256 timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "VeredictChain: somente admin");
        _;
    }

    modifier onlyIntegrador() {
        require(integradoresAutorizados[msg.sender], "VeredictChain: integrador nao autorizado");
        _;
    }

    constructor() {
        admin = msg.sender;
        integradoresAutorizados[msg.sender] = true;
    }

    // ---------------------------------------------------------------------
    // Administração (CNJ / TJPB / entidade gestora do nó)
    // ---------------------------------------------------------------------

    function credenciarMagistrado(bytes32 magistradoHash) external onlyAdmin {
        require(magistradoHash != bytes32(0), "VeredictChain: hash invalido");
        magistradosCredenciados[magistradoHash] = true;
        emit MagistradoCredenciado(magistradoHash);
    }

    function revogarMagistrado(bytes32 magistradoHash) external onlyAdmin {
        magistradosCredenciados[magistradoHash] = false;
        emit MagistradoRevogado(magistradoHash);
    }

    function autorizarIntegrador(address integrador) external onlyAdmin {
        integradoresAutorizados[integrador] = true;
        emit IntegradorAutorizado(integrador);
    }

    function revogarIntegrador(address integrador) external onlyAdmin {
        integradoresAutorizados[integrador] = false;
        emit IntegradorRevogado(integrador);
    }

    function transferirAdmin(address novoAdmin) external onlyAdmin {
        require(novoAdmin != address(0), "VeredictChain: endereco invalido");
        admin = novoAdmin;
    }

    // ---------------------------------------------------------------------
    // Registro de decisões
    // ---------------------------------------------------------------------

    /// @notice Registra o hash de uma decisão recém-assinada (status inicial: Publicada).
    function registrarDecisao(
        bytes32 documentHash,
        string calldata numeroProcesso,
        string calldata tribunalOrigem,
        string calldata orgaoJulgador,
        bytes32 magistradoHash,
        string calldata canalTransmissao
    ) external onlyIntegrador {
        require(documentHash != bytes32(0), "VeredictChain: hash invalido");
        require(decisoes[documentHash].status == Status.Inexistente, "VeredictChain: hash ja registrado");
        require(magistradosCredenciados[magistradoHash], "VeredictChain: magistrado nao credenciado");

        decisoes[documentHash] = Decisao({
            documentHash: documentHash,
            numeroProcesso: numeroProcesso,
            tribunalOrigem: tribunalOrigem,
            orgaoJulgador: orgaoJulgador,
            magistradoHash: magistradoHash,
            canalTransmissao: canalTransmissao,
            timestamp: block.timestamp,
            status: Status.Publicada,
            hashAnterior: bytes32(0),
            registradoPor: msg.sender
        });

        historicoPorProcesso[numeroProcesso].push(documentHash);

        emit DecisaoRegistrada(documentHash, numeroProcesso, magistradoHash, canalTransmissao, block.timestamp);
    }

    /// @notice Registra uma retificação legítima (embargos de declaração, correção material),
    ///         referenciando obrigatoriamente o hash da versão anterior.
    function registrarRetificacao(
        bytes32 novoHash,
        bytes32 hashAnterior,
        string calldata numeroProcesso,
        string calldata tribunalOrigem,
        string calldata orgaoJulgador,
        bytes32 magistradoHash,
        string calldata canalTransmissao
    ) external onlyIntegrador {
        require(novoHash != bytes32(0), "VeredictChain: hash invalido");
        require(decisoes[novoHash].status == Status.Inexistente, "VeredictChain: hash ja registrado");
        require(decisoes[hashAnterior].status != Status.Inexistente, "VeredictChain: hash anterior nao existe");
        require(decisoes[hashAnterior].status != Status.Arquivada, "VeredictChain: decisao anterior arquivada");
        require(magistradosCredenciados[magistradoHash], "VeredictChain: magistrado nao credenciado");

        decisoes[hashAnterior].status = Status.Retificada;

        decisoes[novoHash] = Decisao({
            documentHash: novoHash,
            numeroProcesso: numeroProcesso,
            tribunalOrigem: tribunalOrigem,
            orgaoJulgador: orgaoJulgador,
            magistradoHash: magistradoHash,
            canalTransmissao: canalTransmissao,
            timestamp: block.timestamp,
            status: Status.Publicada,
            hashAnterior: hashAnterior,
            registradoPor: msg.sender
        });

        historicoPorProcesso[numeroProcesso].push(novoHash);

        emit DecisaoRetificada(novoHash, hashAnterior, numeroProcesso, block.timestamp);
    }

    /// @notice Arquiva uma decisão (ex: trânsito em julgado, fim do ciclo de vida processual).
    function arquivarDecisao(bytes32 documentHash) external onlyAdmin {
        require(decisoes[documentHash].status != Status.Inexistente, "VeredictChain: hash nao existe");
        decisoes[documentHash].status = Status.Arquivada;
        emit DecisaoArquivada(documentHash, block.timestamp);
    }

    // ---------------------------------------------------------------------
    // Verificação pública (uso por partes, advogados, cidadãos, sistemas receptores)
    // ---------------------------------------------------------------------

    /// @notice Verifica se um hash está registrado e retorna seus metadados públicos.
    function verificarDecisao(bytes32 documentHash)
        external
        view
        returns (bool existe, Decisao memory decisao)
    {
        decisao = decisoes[documentHash];
        existe = decisao.status != Status.Inexistente;
    }

    /// @notice Retorna o histórico completo (todas as versões) de um número de processo.
    function historicoDoProcesso(string calldata numeroProcesso)
        external
        view
        returns (bytes32[] memory)
    {
        return historicoPorProcesso[numeroProcesso];
    }
}
